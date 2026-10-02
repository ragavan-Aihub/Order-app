import * as Network from 'expo-network';

export const OFFLINE_TITLE = 'You are Offline';
export const OFFLINE_MESSAGE =
  'You are not connected to the internet. Please connect to the internet and try again';

export function isDefinitelyOffline(state: Network.NetworkState): boolean {
  if (state.type === Network.NetworkStateType.NONE) {
    return true;
  }
  const unknown =
    !state.type || state.type === Network.NetworkStateType.UNKNOWN;
  if (state.isConnected === false && !unknown) {
    return true;
  }
  return false;
}

export async function getIsOffline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return isDefinitelyOffline(state);
  } catch {
    return false;
  }
}

export function isNetworkFailure(error: unknown): boolean {
  let message = '';
  if (typeof error === 'string') {
    message = error;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (error && typeof error === 'object' && 'message' in error) {
    message = String((error as { message: unknown }).message);
  } else if (error) {
    message = String(error);
  }
  const lower = message.toLowerCase();
  return (
    lower.includes('network request failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('network error') ||
    lower.includes('internet') ||
    lower.includes('offline') ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower === 'load failed' ||
    lower.includes('could not connect') ||
    lower.includes('the internet connection appears to be offline')
  );
}

export function userFacingError(error: unknown, fallback: string): string {
  if (isNetworkFailure(error)) {
    return OFFLINE_MESSAGE;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}
