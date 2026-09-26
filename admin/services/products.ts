import { MOCK_BUSINESS_ID } from '@/config/constants';
import { isSupabaseConfigured } from '@/config/env';
import { MOCK_PRODUCTS } from '@/data/mock-products';
import { getAdminSession } from '@/services/supabase/admin-session';
import { createServerSupabaseClient } from '@/services/supabase/server';
import type { Product } from '@/types/product';

const PRODUCT_COLUMNS =
  'id, business_id, name, description, price, image_url, available, active, category_id, created_at, updated_at';

const PRODUCT_COLUMNS_FALLBACK =
  'id, business_id, name, description, price, image_url, available, created_at, updated_at';

async function attachCategoryNames(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  businessId: string,
  products: Product[],
): Promise<Product[]> {
  const ids = [...new Set(products.map((p) => p.category_id).filter(Boolean))] as string[];
  if (ids.length === 0) {
    return products;
  }
  const { data: categories } = await supabase
    .from('product_categories')
    .select('id, name')
    .eq('business_id', businessId)
    .in('id', ids);
  const names = new Map((categories ?? []).map((row) => [row.id as string, row.name as string]));
  return products.map((product) => ({
    ...product,
    category_name: product.category_id ? names.get(product.category_id) ?? null : null,
  }));
}

async function attachTransacted(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  products: Product[],
): Promise<Product[]> {
  const ids = products.map((product) => product.id);
  if (ids.length === 0) {
    return products;
  }
  const used = new Set<string>();
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { data } = await supabase.from('order_items').select('product_id').in('product_id', chunk);
    for (const row of data ?? []) {
      if (row.product_id) {
        used.add(row.product_id);
      }
    }
  }
  return products.map((product) => ({
    ...product,
    transacted: used.has(product.id),
  }));
}

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

  const businessId = session.profile.business_id;
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_COLUMNS)
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (!error && data) {
    const named = await attachCategoryNames(supabase, businessId, (data as Product[]).map((row) => ({
      ...row,
      active: row.active !== false,
    })));
    return attachTransacted(supabase, named);
  }

  const fallback = await supabase
    .from('products')
    .select(PRODUCT_COLUMNS_FALLBACK)
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (fallback.error || !fallback.data) {
    return [];
  }

  return attachTransacted(
    supabase,
    (fallback.data as Product[]).map((row) => ({ ...row, active: row.active !== false })),
  );
}

export async function getProductById(id: string): Promise<Product | null> {
  const products = await getAllProducts();
  return products.find((product) => product.id === id) ?? null;
}

export { MOCK_BUSINESS_ID };
