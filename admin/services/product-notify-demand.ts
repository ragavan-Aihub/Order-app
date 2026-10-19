import { createServerSupabaseClient } from '@/services/supabase/server';

export type ProductNotifyDemandRow = {
  product_id: string;
  product_name: string;
  product_available: boolean;
  user_id: string;
  customer_id: string | null;
  customer_name: string;
  customer_mobile: string | null;
  interest_created_at: string;
};

export async function getProductNotifyDemand(): Promise<ProductNotifyDemandRow[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase.rpc('admin_product_notify_demand');
  if (error) {
    console.warn('[product-notify] admin_product_notify_demand', error.message);
    return [];
  }
  return (data ?? []) as ProductNotifyDemandRow[];
}

export async function getProductNotifyCountMap(): Promise<Record<string, number>> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return {};
  }
  const { data, error } = await supabase.rpc('admin_product_notify_counts');
  if (error) {
    console.warn('[product-notify] admin_product_notify_counts', error.message);
    return {};
  }
  const map: Record<string, number> = {};
  for (const row of data ?? []) {
    const productId = row.product_id as string;
    map[productId] = Number(row.notify_count ?? 0);
  }
  return map;
}
