import { getSupabaseClient } from '@/services/supabase';
import type { OrderItem } from '@/types/order';

function normalizeProductId(id: string) {
  return id.trim().toLowerCase();
}

export async function enrichDeliveryOrderItems(
  businessId: string,
  items: OrderItem[],
): Promise<OrderItem[]> {
  if (items.length === 0) {
    return items;
  }

  const productIds = [
    ...new Set(items.map((item) => item.product_id).filter((id): id is string => Boolean(id))),
  ];

  const imageByProductId = new Map<string, string | null>();
  const imageByName = new Map<string, string | null>();

  const supabase = getSupabaseClient();
  if (!supabase) {
    return items;
  }

  if (productIds.length > 0) {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, image_url')
      .eq('business_id', businessId)
      .in('id', productIds);

    if (!error && data) {
      for (const row of data) {
        const url = (row.image_url as string | null) ?? null;
        imageByProductId.set(normalizeProductId(row.id as string), url);
        const key = (row.name as string)?.trim().toLowerCase();
        if (key && url) {
          imageByName.set(key, url);
        }
      }
    }
  }

  const needsNameLookup = items.some((item) => {
    if (item.product_id && imageByProductId.has(normalizeProductId(item.product_id))) {
      return false;
    }
    return Boolean(item.product_name);
  });

  if (needsNameLookup) {
    const { data, error } = await supabase
      .from('products')
      .select('name, image_url')
      .eq('business_id', businessId)
      .not('image_url', 'is', null)
      .limit(400);

    if (!error && data) {
      for (const row of data) {
        const key = (row.name as string)?.trim().toLowerCase();
        if (key) {
          imageByName.set(key, (row.image_url as string | null) ?? null);
        }
      }
    }
  }

  return items.map((item) => {
    let image_url: string | null = null;
    if (item.product_id) {
      image_url = imageByProductId.get(normalizeProductId(item.product_id)) ?? null;
    }
    if (!image_url && item.product_name) {
      image_url = imageByName.get(item.product_name.trim().toLowerCase()) ?? null;
    }
    return { ...item, image_url };
  });
}
