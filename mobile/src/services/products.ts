import { env, isSupabaseConfigured } from '@/config/env';
import { MOCK_PRODUCTS } from '@/data/mock-products';
import { readCachedProducts, writeCachedProducts } from '@/services/catalog-cache';
import { getSupabaseClient } from '@/services/supabase';
import type { Product } from '@/types/product';
import { sortProductsForDisplay } from '@/utils/product-list-sort';

let memoryProducts: Product[] | null = null;
let inflight: Promise<Product[]> | null = null;

const PRODUCT_ROW_SELECT =
  'id, business_id, name, description, ingredients, price, image_url, available, active, category_id, created_at, updated_at';

/** Drop cached catalog so the next fetch hits the network (e.g. after “now available” push). */
export function invalidateProductCatalogCache(): void {
  memoryProducts = null;
  inflight = null;
}

function mergeIntoCatalog(product: Product) {
  if (!memoryProducts) {
    memoryProducts = [product];
    return;
  }
  const index = memoryProducts.findIndex((row) => row.id === product.id);
  if (index >= 0) {
    memoryProducts[index] = product;
  } else {
    memoryProducts.push(product);
  }
  memoryProducts = sortProductsForDisplay(memoryProducts);
  void writeCachedProducts(memoryProducts);
}

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

/** Latest row from Postgres (not catalog cache). Use after availability may have changed. */
export async function fetchProductByIdLive(id: string): Promise<Product | null> {
  if (!isSupabaseConfigured || !env.businessId) {
    return getProductById(id);
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return getProductById(id);
  }
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_ROW_SELECT)
    .eq('id', id)
    .eq('business_id', env.businessId)
    .eq('active', true)
    .maybeSingle();
  if (error || !data) {
    if (__DEV__ && error) {
      console.warn('[products] fetchProductByIdLive', error.message);
    }
    invalidateProductCatalogCache();
    const products = await refreshAvailableProducts();
    return products.find((product) => product.id === id) ?? null;
  }
  const product = data as Product;
  mergeIntoCatalog(product);
  return product;
}

/** Bypass in-memory / disk cache (e.g. after a “now available” push). */
export async function getProductByIdFresh(id: string): Promise<Product | null> {
  invalidateProductCatalogCache();
  const live = await fetchProductByIdLive(id);
  if (live) {
    return live;
  }
  const products = await refreshAvailableProducts();
  return products.find((product) => product.id === id) ?? null;
}
