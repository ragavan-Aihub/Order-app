import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Linking, Platform } from 'react-native';

import type { Business } from '@/types/business';

export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.farm2flavour.app';

export type AppUpdateMode = 'none' | 'optional' | 'required';

export type AppUpdatePrompt = {
  mode: AppUpdateMode;
  kind: 'none' | 'bugfix' | 'feature';
  versionLabel: string | null;
  notes: string | null;
  url: string;
  latestVersionCode: number;
};

export function installedAndroidVersionCode(): number | null {
  const fromNative = Number.parseInt(String(Constants.nativeBuildVersion ?? ''), 10);
  if (Number.isFinite(fromNative) && fromNative > 0) {
    return fromNative;
  }
  const fromConfig = Constants.expoConfig?.android?.versionCode;
  if (typeof fromConfig === 'number' && fromConfig > 0) {
    return fromConfig;
  }
  return null;
}

/** Real installed APK/AAB only. Expo Go and dev builds skip the prompt. */
export function shouldCheckStoreVersion(): boolean {
  if (__DEV__ || Platform.OS !== 'android') {
    return false;
  }
  return Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

export function resolveAppUpdate(business: Business | null, installedCode: number | null): AppUpdatePrompt {
  const empty: AppUpdatePrompt = {
    mode: 'none',
    kind: 'none',
    versionLabel: null,
    notes: null,
    url: PLAY_STORE_URL,
    latestVersionCode: 0,
  };
  if (!business || installedCode == null) {
    return empty;
  }

  const latest = business.customer_app_latest_version_code ?? 0;
  const min = business.customer_app_min_version_code ?? 0;
  const kind = business.customer_app_release_kind ?? 'none';
  const url = business.customer_app_update_url?.trim() || PLAY_STORE_URL;

  if (min > 0 && installedCode < min) {
    return {
      mode: 'required',
      kind: kind === 'feature' ? 'feature' : 'bugfix',
      versionLabel: business.customer_app_latest_version ?? null,
      notes: business.customer_app_release_notes ?? null,
      url,
      latestVersionCode: Math.max(latest, min),
    };
  }

  if (latest > 0 && installedCode < latest) {
    return {
      mode: 'optional',
      kind: kind === 'bugfix' || kind === 'feature' ? kind : 'feature',
      versionLabel: business.customer_app_latest_version ?? null,
      notes: business.customer_app_release_notes ?? null,
      url,
      latestVersionCode: latest,
    };
  }

  return empty;
}

export function updateTitle(prompt: AppUpdatePrompt): string {
  if (prompt.mode === 'required') {
    return 'Please update the app';
  }
  if (prompt.kind === 'bugfix') {
    return 'A fix is ready';
  }
  return 'A new version is available';
}

export function updateBody(prompt: AppUpdatePrompt): string {
  const notes = prompt.notes?.trim();
  if (notes) {
    return notes;
  }
  const version = prompt.versionLabel ? ` (${prompt.versionLabel})` : '';
  if (prompt.mode === 'required') {
    return `This version of the app is no longer supported. Install the latest update${version} to keep ordering.`;
  }
  if (prompt.kind === 'bugfix') {
    return `A small fix is available${version}. Update when you can so orders keep working smoothly.`;
  }
  return `A newer version${version} includes improvements. You can update now or later.`;
}

export async function openAppUpdate(url: string): Promise<void> {
  const target = url.trim() || PLAY_STORE_URL;
  try {
    await Linking.openURL(target);
  } catch {
    // Leave the dialog open so the person can try again.
  }
}
