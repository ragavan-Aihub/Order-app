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
