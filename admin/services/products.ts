import { MOCK_BUSINESS_ID } from '@/config/constants';
import { isSupabaseConfigured } from '@/config/env';
import { MOCK_PRODUCTS } from '@/data/mock-products';
import { getAdminSession } from '@/services/supabase/admin-session';
import { createServerSupabaseClient } from '@/services/supabase/server';
import type { Product } from '@/types/product';

export async function getAllProducts(): Promise<Product[]> {
  if (!isSupabaseConfigured) {
    return MOCK_PRODUCTS;
  }

  const session = await getAdminSession();
  if ('error' in session || !session.profile.business_id) {
    return [];
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('products')
    .select('id, business_id, name, description, price, image_url, available, created_at, updated_at')
    .eq('business_id', session.profile.business_id)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data as Product[];
}

export async function getProductById(id: string): Promise<Product | null> {
  const products = await getAllProducts();
  return products.find((product) => product.id === id) ?? null;
}

export { MOCK_BUSINESS_ID };
