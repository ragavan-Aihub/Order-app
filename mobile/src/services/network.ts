import * as Network from 'expo-network';

export const OFFLINE_TITLE = 'You are Offline';
export const OFFLINE_MESSAGE =
  'You are not connected to the internet. Please connect to the internet and try again';

function isEmptyNetworkState(state: Network.NetworkState): boolean {
  return (
    state.type === undefined &&
    state.isConnected === undefined &&
    state.isInternetReachable === undefined
  );
}

export function isDefinitelyOffline(state: Network.NetworkState): boolean {
  // useNetworkState() starts as {} until the first async read — not offline.
  if (isEmptyNetworkState(state)) {
    return false;
  }

  if (state.type === Network.NetworkStateType.NONE) {
    return true;
  }

  const unknown =
    !state.type || state.type === Network.NetworkStateType.UNKNOWN;

  // Definite disconnect when the OS reports no link (and type is known).
  if (state.isConnected === false && !unknown) {
    return true;
  }

  // Link reported up — never block on reachability alone (Android flips reachable at cold start / resume).
  if (state.isConnected === true) {
    return false;
  }

  // Do not treat isInternetReachable=false when isConnected is still unknown — common after resume.
  return false;
}

/** Stricter check for place-order / save actions (includes unreachable while connected). */
export function isStrictlyOffline(state: Network.NetworkState): boolean {
  if (isEmptyNetworkState(state)) {
    return false;
  }
  if (isDefinitelyOffline(state)) {
    return true;
  }
  return state.isConnected === true && state.isInternetReachable === false;
}

export async function getIsOffline(strict = false): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return strict ? isStrictlyOffline(state) : isDefinitelyOffline(state);
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
