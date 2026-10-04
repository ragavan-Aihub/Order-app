import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Product } from '@/types/product';

const STORAGE_KEY = 'farm2flavour.cart.v1';

type StoredCartItem = {
  product: Product;
  quantity: number;
};

let cached: StoredCartItem[] | null = null;
let loadPromise: Promise<StoredCartItem[]> | null = null;

function isProduct(value: unknown): value is Product {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const product = value as Product;
  return (
    typeof product.id === 'string' &&
    typeof product.name === 'string' &&
    typeof product.price === 'number' &&
    Number.isFinite(product.price)
  );
}

function parseItems(raw: string): StoredCartItem[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is StoredCartItem => {
      if (!item || typeof item !== 'object') {
        return false;
      }
      const quantity = (item as StoredCartItem).quantity;
      return (
        isProduct((item as StoredCartItem).product) &&
        typeof quantity === 'number' &&
        Number.isInteger(quantity) &&
        quantity > 0
      );
    });
  } catch {
    return [];
  }
}

export async function loadCart(): Promise<StoredCartItem[]> {
  if (cached) {
    return cached;
  }
  if (!loadPromise) {
    loadPromise = (async () => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      cached = raw ? parseItems(raw) : [];
      return cached;
    })();
  }
  return loadPromise;
}

export async function saveCart(items: StoredCartItem[]) {
  cached = items;
  loadPromise = Promise.resolve(items);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

const EDIT_KEY = 'farm2flavour.cart.edit.v1';

export type StoredEditState = { orderId: string; fingerprint: string | null; items: StoredCartItem[] | null };

export async function loadEditingOrderId(): Promise<StoredEditState | null> {
  try {
    const raw = await AsyncStorage.getItem(EDIT_KEY);
    if (!raw) {
      return null;
    }
    if (!raw.startsWith('{')) {
      return { orderId: raw, fingerprint: null, items: null };
    }
    const parsed = JSON.parse(raw) as Partial<StoredEditState>;
    return typeof parsed.orderId === 'string' && parsed.orderId
      ? {
          orderId: parsed.orderId,
          fingerprint: typeof parsed.fingerprint === 'string' ? parsed.fingerprint : null,
          items: Array.isArray(parsed.items) ? parseItems(JSON.stringify(parsed.items)) : null,
        }
      : null;
  } catch {
    return null;
  }
}

export async function saveEditingOrderId(
  orderId: string | null,
  fingerprint: string | null = null,
  items: StoredCartItem[] | null = null,
) {
  try {
    if (orderId) {
      await AsyncStorage.setItem(EDIT_KEY, JSON.stringify({ orderId, fingerprint, items }));
    } else {
      await AsyncStorage.removeItem(EDIT_KEY);
    }
  } catch {
    // keep in-memory cart even if persist fails
  }
}
