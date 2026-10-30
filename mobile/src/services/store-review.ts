import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

const PLACEMENT_COUNT_KEY = '@farm2flavour/successful_order_placements';
const REVIEW_REQUESTED_KEY = '@farm2flavour/store_review_requested';

/** Ask for Play Store review after this many new orders (not cart updates). */
export const STORE_REVIEW_MIN_SUCCESSFUL_PLACEMENTS = 2;

/**
 * Call once when the customer lands on confirmation after a **new** order (fresh=placed).
 * After {@link STORE_REVIEW_MIN_SUCCESSFUL_PLACEMENTS}, may show the native in-app review UI once per install.
 * Works on installed APK/AAB from Play; often no-op in Expo Go.
 */
export async function recordSuccessfulPlacementAndMaybeAskForReview(): Promise<void> {
  if (__DEV__) {
    return;
  }

  try {
    const already = await AsyncStorage.getItem(REVIEW_REQUESTED_KEY);
    if (already === '1') {
      return;
    }

    const raw = await AsyncStorage.getItem(PLACEMENT_COUNT_KEY);
    const count = (raw ? Number.parseInt(raw, 10) : 0) || 0;
    const next = count + 1;
    await AsyncStorage.setItem(PLACEMENT_COUNT_KEY, String(next));

    if (next < STORE_REVIEW_MIN_SUCCESSFUL_PLACEMENTS) {
      return;
    }

    const available = await StoreReview.isAvailableAsync();
    if (!available) {
      return;
    }

    await StoreReview.requestReview();
    await AsyncStorage.setItem(REVIEW_REQUESTED_KEY, '1');
  } catch {
    // Non-critical; never block checkout UX.
  }
}
