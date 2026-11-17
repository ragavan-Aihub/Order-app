import * as Linking from 'expo-linking';

import { isAuthCallbackUrl } from '@/services/auth-deeplink';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let pendingProductId: string | null = null;

function asProductId(value: string | null | undefined): string | null {
  const id = value?.trim() ?? '';
  if (!id || !UUID_RE.test(id)) {
    return null;
  }
  return id;
}

/** Parse product id from custom scheme or HTTPS /p/{id} share links. */
export function productIdFromUrl(url: string | null | undefined): string | null {
  if (!url || isAuthCallbackUrl(url)) {
    return null;
  }
  try {
    const parsed = Linking.parse(url);
    const host = (parsed.hostname ?? '').replace(/^\//, '');
    const path = (parsed.path ?? '').replace(/^\//, '');

    // farm2flavour://product/<uuid>
    if (host === 'product') {
      return asProductId(path.split('/')[0]);
    }

    // farm2flavour:///product/<uuid> or path-only
    const productMatch = path.match(/^product\/([^/?#]+)/i);
    if (productMatch) {
      return asProductId(productMatch[1]);
    }

    // https://admin…/p/<uuid>
    const shareMatch = path.match(/^p\/([^/?#]+)/i);
    if (shareMatch) {
      return asProductId(shareMatch[1]);
    }

    return null;
  } catch {
    return null;
  }
}

export function peekPendingProductDeepLink(): string | null {
  return pendingProductId;
}

export function takePendingProductDeepLink(): string | null {
  const next = pendingProductId;
  pendingProductId = null;
  return next;
}

export function queueProductDeepLink(productId: string) {
  pendingProductId = productId;
}

export function rememberProductDeepLinkFromUrl(url: string | null | undefined): string | null {
  const id = productIdFromUrl(url);
  if (id) {
    queueProductDeepLink(id);
  }
  return id;
}

/** Cold start: read launch URL once for index routing. */
export async function captureInitialProductDeepLink(): Promise<string | null> {
  return rememberProductDeepLinkFromUrl(await Linking.getInitialURL());
}

/** Runtime only — cold start is handled by the welcome/index gate. */
export function watchProductDeepLinks(onProductId: (productId: string) => void) {
  const sub = Linking.addEventListener('url', (event) => {
    const id = rememberProductDeepLinkFromUrl(event.url);
    if (id) {
      onProductId(id);
    }
  });
  return () => sub.remove();
}
