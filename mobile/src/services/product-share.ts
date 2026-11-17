import Constants from 'expo-constants';
import { Linking, Platform, Share } from 'react-native';

import { env } from '@/config/env';
import { PLAY_STORE_URL } from '@/services/app-update';

function trimSlash(value: string) {
  return value.replace(/\/+$/, '');
}

/**
 * HTTPS base for shared product links (admin Vercel `/p/{id}`).
 * Prefer EXPO_PUBLIC_SHARE_BASE_URL; else derive from Sam admin origin.
 */
export function getShareBaseUrl(): string | null {
  if (env.shareBaseUrl) {
    return trimSlash(env.shareBaseUrl);
  }
  const fromProcess = (process.env.EXPO_PUBLIC_SHARE_BASE_URL ?? '').trim();
  if (fromProcess) {
    return trimSlash(fromProcess);
  }
  const extra = Constants.expoConfig?.extra as { shareBaseUrl?: string } | undefined;
  const fromExtra = extra?.shareBaseUrl?.trim();
  if (fromExtra) {
    return trimSlash(fromExtra);
  }
  const sam = env.samApiUrl.trim();
  if (sam) {
    try {
      const url = new URL(sam);
      return trimSlash(`${url.protocol}//${url.host}`);
    } catch {
      // ignore
    }
  }
  return null;
}

export function productShareUrl(productId: string): string | null {
  const base = getShareBaseUrl();
  if (!base) {
    return null;
  }
  return `${base}/p/${productId}`;
}

export function productShareMessage(productName: string, shareUrl: string) {
  return `${productName}\n${shareUrl}\n\nOpen in Farm2Flavour (Android). iPhone app coming soon.`;
}

export async function shareProductViaSystem(productName: string, shareUrl: string) {
  await Share.share(
    Platform.OS === 'ios'
      ? { message: productShareMessage(productName, shareUrl), url: shareUrl }
      : { message: productShareMessage(productName, shareUrl) },
  );
}

export async function shareProductViaWhatsApp(productName: string, shareUrl: string) {
  const text = encodeURIComponent(productShareMessage(productName, shareUrl));
  const appUrl = `whatsapp://send?text=${text}`;
  const webUrl = `https://wa.me/?text=${text}`;
  try {
    const can = await Linking.canOpenURL(appUrl);
    await Linking.openURL(can ? appUrl : webUrl);
  } catch {
    await Linking.openURL(webUrl);
  }
}

export { PLAY_STORE_URL };
