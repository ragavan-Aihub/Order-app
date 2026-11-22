import * as Sharing from 'expo-sharing';
import { AppState, type AppStateStatus } from 'react-native';

import { withTimeout } from '@/utils/async';

const SHARE_SHEET_MS = 3 * 60_000;

function waitForForegroundAfterShare(): Promise<void> {
  return new Promise((resolve) => {
    let sawBackground = false;
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'inactive' || next === 'background') {
        sawBackground = true;
      }
      if (next === 'active' && sawBackground) {
        sub.remove();
        resolve();
      }
    });
  });
}

async function runShareAsync(
  uri: string,
  options: Parameters<typeof Sharing.shareAsync>[1],
): Promise<void> {
  try {
    await Sharing.shareAsync(uri, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/cancel|dismiss|did not share|user did not share/i.test(message)) {
      return;
    }
    throw error instanceof Error ? error : new Error(message || 'Could not open the share sheet.');
  }
}

/**
 * Open the system share sheet for a PDF. On some Android builds `shareAsync` never
 * settles when the user leaves for WhatsApp — we still complete when the app
 * returns to the foreground or when the action times out.
 */
export async function sharePdfFile(
  uri: string,
  options: Parameters<typeof Sharing.shareAsync>[1],
): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Sharing is not available on this phone.');
  }

  await withTimeout(
    Promise.race([runShareAsync(uri, options), waitForForegroundAfterShare()]),
    SHARE_SHEET_MS,
    'Sharing took too long. If you already sent the bill on WhatsApp, tap Not now or go back.',
  );
}