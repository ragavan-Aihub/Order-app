import { MOCK_BUSINESS_ID } from '@/config/constants';
import { isSupabaseConfigured } from '@/config/env';
import { MOCK_PRODUCTS } from '@/data/mock-products';
import { getAdminSession } from '@/services/supabase/admin-session';
import { createServerSupabaseClient } from '@/services/supabase/server';
import type { Product } from '@/types/product';

const PRODUCT_COLUMNS =
  'id, business_id, name, description, ingredients, price, selling_type, selling_unit, price_per_kg, price_per_liter, minimum_weight_grams, maximum_weight_grams, image_url, available, stock_qty, active, category_id, created_at, updated_at';

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
    .order('name', { ascending: true });

  if (!error && data) {
    const named = await attachCategoryNames(supabase, businessId, (data as Product[]).map((row) => ({
      ...row,
      active: row.active !== false,
      selling_type:
        row.selling_type === 'kg' || row.selling_type === 'liter' || row.selling_type === 'fixed_pack'
          ? row.selling_type
          : 'quantity',
    })));
    return attachTransacted(
      supabase,
      await attachVolumeOptions(supabase, await attachWeightOptions(supabase, await attachPacks(supabase, named))),
    );
  }

  const fallback = await supabase
    .from('products')
    .select(PRODUCT_COLUMNS_FALLBACK)
    .eq('business_id', businessId)
    .order('name', { ascending: true });

  if (fallback.error || !fallback.data) {
    return [];
  }

  return attachTransacted(
    supabase,
    (fallback.data as Product[]).map((row) => ({ ...row, active: row.active !== false })),
  );
}

async function attachPacks(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  products: Product[],
): Promise<Product[]> {
  const ids = products.map((product) => product.id);
  if (ids.length === 0) {
    return products;
  }
  const { data } = await supabase
    .from('product_pack_options')
    .select('id, product_id, weight_grams, selling_price, is_active, display_order')
    .in('product_id', ids)
    .order('display_order', { ascending: true });
  const byProduct = new Map<string, NonNullable<Product['packs']>>();
  for (const row of data ?? []) {
    const list = byProduct.get(row.product_id) ?? [];
    list.push({
      id: row.id,
      product_id: row.product_id,
      weight_grams: Number(row.weight_grams),
      selling_price: Number(row.selling_price),
      is_active: Boolean(row.is_active),
      display_order: Number(row.display_order) || 0,
    });
    byProduct.set(row.product_id, list);
  }
  return products.map((product) => ({
    ...product,
    packs: byProduct.get(product.id) ?? [],
  }));
}

async function attachWeightOptions(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  products: Product[],
): Promise<Product[]> {
  const ids = products.filter((product) => product.selling_type === 'kg').map((product) => product.id);
  if (ids.length === 0) {
    return products;
  }
  const { data } = await supabase
    .from('product_weight_options')
    .select('id, product_id, weight_grams, is_active, display_order')
    .in('product_id', ids)
    .order('display_order', { ascending: true });
  const byProduct = new Map<string, NonNullable<Product['weightOptions']>>();
  for (const row of data ?? []) {
    const list = byProduct.get(row.product_id) ?? [];
    list.push({
      id: row.id,
      product_id: row.product_id,
      weight_grams: Number(row.weight_grams),
      is_active: Boolean(row.is_active),
      display_order: Number(row.display_order) || 0,
    });
    byProduct.set(row.product_id, list);
  }
  return products.map((product) => ({
    ...product,
    weightOptions: byProduct.get(product.id) ?? [],
  }));
}

async function attachVolumeOptions(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  products: Product[],
): Promise<Product[]> {
  const ids = products.filter((product) => product.selling_type === 'liter').map((product) => product.id);
  if (ids.length === 0) {
    return products;
  }
  const { data } = await supabase
    .from('product_volume_options')
    .select('id, product_id, volume_ml, is_active, display_order')
    .in('product_id', ids)
    .order('display_order', { ascending: true });
  const byProduct = new Map<string, NonNullable<Product['volumeOptions']>>();
  for (const row of data ?? []) {
    const list = byProduct.get(row.product_id) ?? [];
    list.push({
      id: row.id,
      product_id: row.product_id,
      volume_ml: Number(row.volume_ml),
      is_active: Boolean(row.is_active),
      display_order: Number(row.display_order) || 0,
    });
    byProduct.set(row.product_id, list);
  }
  return products.map((product) => ({
    ...product,
    volumeOptions: byProduct.get(product.id) ?? [],
  }));
}

export async function getProductById(id: string): Promise<Product | null> {
  const products = await getAllProducts();
  return products.find((product) => product.id === id) ?? null;
}

export { MOCK_BUSINESS_ID };
