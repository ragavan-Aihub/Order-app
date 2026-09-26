import { env, isSupabaseConfigured } from '@/config/env';
import { readCachedCategories, writeCachedCategories } from '@/services/catalog-cache';
import { getSupabaseClient } from '@/services/supabase';
import type { ShopCategory } from '@/types/category';

export async function getShopCategories(): Promise<ShopCategory[]> {
  const cached = (await readCachedCategories()) ?? [];
  if (!isSupabaseConfigured || !env.businessId) {
    return cached;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return cached;
  }

  try {
    const { data, error } = await supabase.rpc('get_shop_categories', {
      p_business_id: env.businessId,
    });
    if (error) {
      return cached;
    }
    if (!data) {
      await writeCachedCategories([]);
      return [];
    }
    const categories = (data as ShopCategory[]).map((row) => ({
      id: row.id,
      name: row.name,
      image_url: row.image_url ?? null,
    }));
    await writeCachedCategories(categories);
    return categories;
  } catch {
    return cached;
  }
}
