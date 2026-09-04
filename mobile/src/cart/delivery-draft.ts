import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DeliveryDetails } from '@/services/orders';

const STORAGE_KEY = 'farm2flavour.delivery-draft';

let draft: DeliveryDetails | null = null;
let loadPromise: Promise<DeliveryDetails | null> | null = null;

export function getDeliveryDraft(): DeliveryDetails | null {
  return draft;
}

export async function loadDeliveryDraft(): Promise<DeliveryDetails | null> {
  if (draft) {
    return draft;
  }
  if (!loadPromise) {
    loadPromise = (async () => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      try {
        const parsed = JSON.parse(raw) as DeliveryDetails;
        if (parsed && typeof parsed.address === 'string' && typeof parsed.pincode === 'string') {
          draft = parsed;
        }
      } catch {
        draft = null;
      }
      return draft;
    })();
  }
  return loadPromise;
}

export async function saveDeliveryDraft(details: DeliveryDetails) {
  draft = details;
  loadPromise = Promise.resolve(details);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(details));
}
