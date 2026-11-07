import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { Href } from 'expo-router';

import { env } from '@/config/env';
import { OFFLINE_MESSAGE, getIsOffline, isNetworkFailure } from '@/services/network';
import { getSupabaseClient } from '@/services/supabase';

WebBrowser.maybeCompleteAuthSession();

export type GoogleAuthResult =
  | { status: 'success' }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

const exchanges = new Map<string, Promise<GoogleAuthResult>>();
const PENDING_NEXT_KEY = 'farm2flavour.google-auth-next';
let googleSignInInFlight: Promise<GoogleAuthResult> | null = null;

export function destinationFor(next?: string | null): Href {
  if (next === 'checkout') return '/checkout';
  if (next === 'cart') return '/cart';
  if (next === 'orders') return '/orders';
  if (next === 'buy-again' || next === 'reorder') return '/buy-again';
  if (next === 'account') return '/account';
  if (next === 'sam') return '/sam';
  return '/home';
}

export async function rememberAuthNext(next?: string | null) {
  await AsyncStorage.setItem(PENDING_NEXT_KEY, next?.trim() || 'home');
}

export async function takeAuthNext() {
  const next = await AsyncStorage.getItem(PENDING_NEXT_KEY);
  await AsyncStorage.removeItem(PENDING_NEXT_KEY);
  return destinationFor(next);
}

/** Must match the Supabase Auth redirect allow list. A dev-server host is not included. */
export const AUTH_REDIRECT = 'farm2flavour://auth/callback';

function randomNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

function paramsFromAuthUrl(url: string) {
  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1).split('#')[0] : '';
  return new URLSearchParams(hash || query);
}

function firstQuery(value: unknown) {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : '';
  }
  return typeof value === 'string' ? value : '';
}

function mapGoogleError(message: string) {
  if (isNetworkFailure(message)) {
    return OFFLINE_MESSAGE;
  }
  const lower = message.toLowerCase();
  if (lower.includes('provider is not enabled') || lower.includes('unsupported provider')) {
    return 'Google sign-in is not turned on yet.';
  }
  if (lower.includes('already') && (lower.includes('link') || lower.includes('identity'))) {
    return 'This Google account is already used on another sign-in. Orders on this mobile number stay here.';
  }
  return message || 'Google sign-in did not finish. Try again.';
}

function displayName(metadata: Record<string, unknown> | undefined) {
  const fullName = metadata?.full_name;
  const name = metadata?.name;
  if (typeof fullName === 'string' && fullName.trim()) {
    return fullName.trim();
  }
  if (typeof name === 'string' && name.trim()) {
    return name.trim();
  }
  return null;
}

async function ensureProfileAfterSession(): Promise<GoogleAuthResult> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { status: 'error', message: 'Sign-in is not configured.' };
  }
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    return { status: 'error', message: 'Google sign-in did not finish. Try again.' };
  }
  if (!env.businessId) {
    return { status: 'error', message: 'This shop is not configured.' };
  }

  const { error } = await supabase.rpc('ensure_customer_profile', {
    p_business_id: env.businessId,
    p_name: displayName(data.session.user.user_metadata as Record<string, unknown> | undefined),
    p_mobile: null,
  });
  if (error) {
    return { status: 'error', message: mapGoogleError(error.message) };
  }
  return { status: 'success' };
}

async function exchangeCode(code: string, flowId: string | null): Promise<GoogleAuthResult> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { status: 'error', message: 'Sign-in is not configured.' };
  }
  const { error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
  if (error) {
    return { status: 'error', message: mapGoogleError(error.message) };
  }
  return ensureProfileAfterSession();
}

/** Exchange one OAuth code once. A second caller waits on the same attempt. No profile write unless a session exists. */
async function finishEmailLink(tokenHash: string, type: string | null): Promise<GoogleAuthResult> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { status: 'error', message: 'Sign-in is not configured.' };
  }
  const otpType = type === 'signup' || type === 'invite' || type === 'magiclink' || type === 'email' ? type : 'email';
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: otpType,
  });
  if (error) {
    return { status: 'error', message: mapGoogleError(error.message) };
  }
  return ensureProfileAfterSession();
}

async function finishEmailSession(accessToken: string, refreshToken: string): Promise<GoogleAuthResult> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { status: 'error', message: 'Sign-in is not configured.' };
  }
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) {
    return { status: 'error', message: mapGoogleError(error.message) };
  }
  return ensureProfileAfterSession();
}

async function signInWithGoogleIdToken(idToken: string, nonce?: string): Promise<GoogleAuthResult> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { status: 'error', message: 'Sign-in is not configured.' };
  }
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
    nonce,
  });
  if (error) {
    return { status: 'error', message: mapGoogleError(error.message) };
  }
  return ensureProfileAfterSession();
}

export function completeAuthRedirect(url: string, flowId?: string | null): Promise<GoogleAuthResult> {
  const params = paramsFromAuthUrl(url);
  const parsed = Linking.parse(url);
  const query = parsed.queryParams ?? {};
  const idToken = params.get('id_token') ?? firstQuery(query.id_token);
  if (idToken) {
    return signInWithGoogleIdToken(idToken);
  }
  const tokenHash = params.get('token_hash') ?? firstQuery(query.token_hash);
  const emailType = params.get('type') ?? firstQuery(query.type);
  if (tokenHash) {
    return finishEmailLink(tokenHash, emailType);
  }
  const accessToken = params.get('access_token') ?? firstQuery(query.access_token);
  const refreshToken = params.get('refresh_token') ?? firstQuery(query.refresh_token);
  if (accessToken && refreshToken) {
    return finishEmailSession(accessToken, refreshToken);
  }
  const code = params.get('code') ?? firstQuery(query.code);
  const errorCode = params.get('error') ?? firstQuery(query.error);
  const errorDescription = params.get('error_description') ?? firstQuery(query.error_description);
  const redirectFlowId = params.get('flow_id') ?? firstQuery(query.flow_id) ?? null;

  if (!code) {
    if (errorCode === 'access_denied' || errorCode === 'user_cancelled') {
      return Promise.resolve({ status: 'cancelled' });
    }
    return Promise.resolve({
      status: 'error',
      message: mapGoogleError(errorDescription || errorCode || 'Google sign-in did not finish. Try again.'),
    });
  }

  const existing = exchanges.get(code);
  if (existing) {
    return existing;
  }

  const pending = exchangeCode(code, flowId || redirectFlowId).then((result) => {
    if (result.status !== 'success') {
      exchanges.delete(code);
    }
    return result;
  });
  exchanges.set(code, pending);
  return pending;
}

async function openProviderUrl(url: string, flowId: string | null): Promise<GoogleAuthResult> {
  const result = await WebBrowser.openAuthSessionAsync(url, AUTH_REDIRECT);
  if (result.type === 'cancel' || result.type === 'dismiss') {
    return { status: 'cancelled' };
  }
  if (result.type !== 'success') {
    return { status: 'error', message: 'Google sign-in did not finish. Try again.' };
  }
  return completeAuthRedirect(result.url, flowId);
}

async function startProvider(
  start: () => Promise<{ url: string | null; flowId: string | null; errorMessage: string | null }>,
): Promise<GoogleAuthResult> {
  if (await getIsOffline()) {
    return { status: 'error', message: OFFLINE_MESSAGE };
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { status: 'error', message: 'Sign-in is not configured.' };
  }

  try {
    const started = await start();
    if (started.errorMessage) {
      return { status: 'error', message: mapGoogleError(started.errorMessage) };
    }
    if (!started.url) {
      return { status: 'error', message: 'Google sign-in did not finish. Try again.' };
    }
    return await openProviderUrl(started.url, started.flowId);
  } catch (error) {
    if (isNetworkFailure(error)) {
      return { status: 'error', message: OFFLINE_MESSAGE };
    }
    return {
      status: 'error',
      message: error instanceof Error ? mapGoogleError(error.message) : 'Google sign-in did not finish. Try again.',
    };
  }
}

function googleNativeError(error: unknown): GoogleAuthResult {
  const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : '';
  if (code === statusCodes.SIGN_IN_CANCELLED) {
    return { status: 'cancelled' };
  }
  if (code === statusCodes.IN_PROGRESS) {
    return { status: 'error', message: 'Google sign-in is already open.' };
  }
  if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return { status: 'error', message: 'Google Play services is missing on this phone.' };
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/native module|RNGoogleSignin|null is not an object/i.test(message)) {
    return {
      status: 'error',
      message: 'This installed app cannot use the Google account on the phone. Install the new development build, then try again.',
    };
  }
  return { status: 'error', message: mapGoogleError(message) };
}

export function signInWithGoogle() {
  if (googleSignInInFlight) {
    return googleSignInInFlight;
  }
  googleSignInInFlight = (async (): Promise<GoogleAuthResult> => {
    if (await getIsOffline()) {
      return { status: 'error', message: OFFLINE_MESSAGE };
    }
    if (!env.googleWebClientId) {
      return {
        status: 'error',
        message: 'Google sign-in is missing the Web client ID on this install.',
      };
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { status: 'error', message: 'Sign-in is not configured.' };
    }
    try {
      GoogleSignin.configure({
        webClientId: env.googleWebClientId,
        offlineAccess: false,
      });
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const silent = await GoogleSignin.signInSilently();
      let idToken = silent.type === 'success' ? silent.data.idToken : null;
      if (!idToken) {
        const interactive = await GoogleSignin.signIn();
        if (interactive.type === 'cancelled') {
          return { status: 'cancelled' };
        }
        idToken = interactive.data.idToken;
      }
      if (!idToken) {
        idToken = (await GoogleSignin.getTokens()).idToken;
      }
      if (!idToken) {
        return { status: 'error', message: 'Google did not return a sign-in token.' };
      }
      return await signInWithGoogleIdToken(idToken);
    } catch (error) {
      if (isNetworkFailure(error)) {
        return { status: 'error', message: OFFLINE_MESSAGE };
      }
      return googleNativeError(error);
    }
  })().finally(() => {
    googleSignInInFlight = null;
  });
  return googleSignInInFlight;
}

/** Attach Google to the phone user that is already signed in. Does not create a second account. */
export function linkGoogleIdentity() {
  return startProvider(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { url: null, flowId: null, errorMessage: 'Sign-in is not configured.' };
    }
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      return { url: null, flowId: null, errorMessage: 'Sign in with your mobile number first.' };
    }
    const { data, error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        redirectTo: AUTH_REDIRECT,
        skipBrowserRedirect: true,
      },
    });
    return {
      url: data?.url ?? null,
      flowId: data?.flowId ?? null,
      errorMessage: error?.message ?? null,
    };
  });
}
