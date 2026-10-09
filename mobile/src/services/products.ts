import { env, isSupabaseConfigured } from '@/config/env';
import { MOCK_PRODUCTS } from '@/data/mock-products';
import { readCachedProducts, writeCachedProducts } from '@/services/catalog-cache';
import { getSupabaseClient } from '@/services/supabase';
import type { Product } from '@/types/product';
import { sortProductsForDisplay } from '@/utils/product-list-sort';

let memoryProducts: Product[] | null = null;
let inflight: Promise<Product[]> | null = null;

async function fetchLiveProducts(): Promise<Product[]> {
  if (inflight) {
    return inflight;
  }
  inflight = (async () => {
    if (!isSupabaseConfigured || !env.businessId) {
      const mock = sortProductsForDisplay(MOCK_PRODUCTS.filter((product) => product.active !== false));
      memoryProducts = mock;
      return mock;
    }
    const supabase = getSupabaseClient();
    const cached = memoryProducts ?? (await readCachedProducts());
    if (!supabase) {
      memoryProducts = cached ?? [];
      return memoryProducts;
    }
    try {
      const { data, error } = await supabase.rpc('get_available_products', {
        p_business_id: env.businessId,
      });
      if (error || !data) {
        memoryProducts = sortProductsForDisplay(cached ?? []);
        return memoryProducts;
      }
      const products = sortProductsForDisplay(data as Product[]);
      memoryProducts = products;
      void writeCachedProducts(products);
      return products;
    } catch {
      memoryProducts = sortProductsForDisplay(cached ?? []);
      return memoryProducts;
    }
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export async function getCachedProducts(): Promise<Product[]> {
  if (memoryProducts?.length) {
    return memoryProducts;
  }
  if (!isSupabaseConfigured || !env.businessId) {
    return MOCK_PRODUCTS.filter((product) => product.active !== false);
  }
  const cached = await readCachedProducts();
  if (cached?.length) {
    memoryProducts = cached;
    return cached;
  }
  return [];
}

export async function refreshAvailableProducts(): Promise<Product[]> {
  return fetchLiveProducts();
}

export async function getAvailableProducts(): Promise<Product[]> {
  const cached = await getCachedProducts();
  if (cached.length) {
    void fetchLiveProducts();
    return cached;
  }
  return fetchLiveProducts();
}

export async function getProductById(id: string): Promise<Product | null> {
  const products = await getAvailableProducts();
  return products.find((product) => product.id === id) ?? null;
}
