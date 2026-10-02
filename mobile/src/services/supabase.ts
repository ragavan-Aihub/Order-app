import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env, isSupabaseConfigured } from '@/config/env';

import 'react-native-url-polyfill/auto';

let client: SupabaseClient | null = null;

const REQUEST_MS = 20000;

const timedFetch: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const outer = init?.signal;
  if (outer) {
    if (outer.aborted) {
      controller.abort();
    } else {
      outer.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }
  const timer = setTimeout(() => controller.abort(), REQUEST_MS);
  const started = Date.now();
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const label = `${init?.method ?? 'GET'} ${url.replace(env.supabaseUrl, '').split('?')[0]}`;
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    if (__DEV__) {
      console.log(`[supabase] ${label} ${response.status} ${Date.now() - started}ms`);
    }
    return response;
  } catch (error) {
    if (__DEV__) {
      console.log(`[supabase] ${label} FAILED ${Date.now() - started}ms ${String(error)}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) {
    return null;
  }

  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
      global: { fetch: timedFetch },
    });
  }

  return client;
}

export async function getSignedInUser() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user ?? null;
  } catch {
    return null;
  }
}
