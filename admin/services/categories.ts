import type { ProductCategoryListItem } from '@/types/category';
import { getAdminSession } from '@/services/supabase/admin-session';
import { createServerSupabaseClient } from '@/services/supabase/server';

export async function getCategories(): Promise<ProductCategoryListItem[]> {
  const session = await getAdminSession();
  if ('error' in session || !session.profile.business_id) {
    return [];
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return [];
  }
  const businessId = session.profile.business_id;

  const [{ data: rows, error: categoryError }, { data: products }] = await Promise.all([
    supabase
      .from('product_categories')
      .select('id, business_id, name, image_url, active, created_at, updated_at')
      .eq('business_id', businessId)
      .order('name', { ascending: true }),
    supabase.from('products').select('category_id').eq('business_id', businessId),
  ]);

  let categoryRows = rows ?? [];
  if (categoryError) {
    const fallback = await supabase
      .from('product_categories')
      .select('id, business_id, name, active, created_at, updated_at')
      .eq('business_id', businessId)
      .order('name', { ascending: true });
    categoryRows = (fallback.data ?? []).map((row) => ({ ...row, image_url: null }));
  }

  const counts = new Map<string, number>();
  for (const row of products ?? []) {
    if (!row.category_id) {
      continue;
    }
    counts.set(row.category_id as string, (counts.get(row.category_id as string) ?? 0) + 1);
  }

  return categoryRows.map((row) => ({
    ...(row as ProductCategoryListItem),
    image_url: (row as { image_url?: string | null }).image_url ?? null,
    productCount: counts.get(row.id) ?? 0,
  }));
}

export async function getCategoryById(id: string): Promise<ProductCategoryListItem | null> {
  const list = await getCategories();
  return list.find((item) => item.id === id) ?? null;
}

export async function getActiveCategories(): Promise<Array<{ id: string; name: string }>> {
  const list = await getCategories();
  return list.filter((item) => item.active).map((item) => ({ id: item.id, name: item.name }));
}
