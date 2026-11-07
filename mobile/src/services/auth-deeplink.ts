import * as Linking from 'expo-linking';

import { completeAuthRedirect } from '@/services/google-auth';

const inflight = new Map<string, Promise<Awaited<ReturnType<typeof completeAuthRedirect>> | null>>();

export function isAuthCallbackUrl(url: string | null | undefined) {
  if (!url) {
    return false;
  }
  const lower = url.toLowerCase();
  return (
    lower.includes('auth/callback') ||
    lower.includes('token_hash=') ||
    lower.includes('access_token=') ||
    /[?&#]code=/.test(lower)
  );
}

export function consumeAuthUrl(url: string | null | undefined) {
  if (!url || !isAuthCallbackUrl(url)) {
    return Promise.resolve(null);
  }
  const existing = inflight.get(url);
  if (existing) {
    return existing;
  }
  const normalized = url.includes('#') && !url.includes('?') ? url.replace('#', '?') : url;
  const pending = completeAuthRedirect(normalized);
  inflight.set(url, pending);
  return pending;
}

export function watchAuthDeepLinks(onUrl: (url: string) => void) {
  void Linking.getInitialURL().then((url) => {
    if (url) onUrl(url);
  });
  const sub = Linking.addEventListener('url', (event) => {
    if (event.url) onUrl(event.url);
  });
  return () => sub.remove();
}
