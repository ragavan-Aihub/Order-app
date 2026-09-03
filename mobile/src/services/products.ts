import { env, isSupabaseConfigured } from '@/config/env';
import { MOCK_PRODUCTS } from '@/data/mock-products';
import { getSupabaseClient } from '@/services/supabase';
import type { Product } from '@/types/product';

export async function getAvailableProducts(): Promise<Product[]> {
  if (!isSupabaseConfigured || !env.businessId) {
    return MOCK_PRODUCTS.filter((product) => product.available);
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return MOCK_PRODUCTS.filter((product) => product.available);
  }

  const { data, error } = await supabase.rpc('get_available_products', {
    p_business_id: env.businessId,
  });

  if (error || !data) {
    return MOCK_PRODUCTS.filter((product) => product.available);
  }

  return data as Product[];
}

export async function getProductById(id: string): Promise<Product | null> {
  const products = await getAvailableProducts();
  return products.find((product) => product.id === id) ?? null;
}
