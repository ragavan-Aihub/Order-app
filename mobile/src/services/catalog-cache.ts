import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Business } from '@/types/business';
import type { ShopCategory } from '@/types/category';
import type { Product } from '@/types/product';

const PRODUCTS_KEY = 'farm2flavour.catalog.products.v4';
const BUSINESS_KEY = 'farm2flavour.catalog.business.v2';
const CATEGORIES_KEY = 'farm2flavour.catalog.categories.v3';

export async function readCachedProducts(): Promise<Product[] | null> {
  try {
    const raw = await AsyncStorage.getItem(PRODUCTS_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return null;
    }
    return parsed as Product[];
  } catch {
    return null;
  }
}

export async function writeCachedProducts(products: Product[]): Promise<void> {
  try {
    await AsyncStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  } catch {
    // Keep browsing even if the cache write fails.
  }
}

export async function readCachedBusiness(): Promise<Business | null> {
  try {
    const raw = await AsyncStorage.getItem(BUSINESS_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as Business;
  } catch {
    return null;
  }
}

export async function writeCachedBusiness(business: Business): Promise<void> {
  try {
    await AsyncStorage.setItem(BUSINESS_KEY, JSON.stringify(business));
  } catch {
    // Ignore cache write failures.
  }
}

export async function hasCatalogCache(): Promise<boolean> {
  const products = await readCachedProducts();
  return Boolean(products && products.length > 0);
}

export async function readCachedCategories(): Promise<ShopCategory[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CATEGORIES_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }
    return parsed as ShopCategory[];
  } catch {
    return null;
  }
}

export async function writeCachedCategories(categories: ShopCategory[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  } catch {
    // Ignore cache write failures.
  }
}
