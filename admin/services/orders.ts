import { getAdminSession } from '@/services/supabase/admin-session';
import { createServerSupabaseClient } from '@/services/supabase/server';
import type { Order, OrderItem, OrderWithItems } from '@/types/order';

const ORDER_COLUMNS =
  'id, order_number, business_id, user_id, customer_name, mobile, delivery_address, pincode, total_amount, status, created_at, updated_at';

export async function getAllOrders(): Promise<Order[]> {
  const session = await getAdminSession();
  if ('error' in session || !session.profile.business_id) {
    return [];
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('business_id', session.profile.business_id)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data as Order[];
}

export async function getOrderById(id: string): Promise<OrderWithItems | null> {
  const session = await getAdminSession();
  if ('error' in session || !session.profile.business_id) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return null;
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('id', id)
    .eq('business_id', session.profile.business_id)
    .maybeSingle();

  if (orderError || !order) {
    return null;
  }

  const { data: items } = await supabase
    .from('order_items')
    .select('id, order_id, product_id, product_name, product_price, quantity, subtotal, created_at')
    .eq('order_id', id)
    .order('created_at', { ascending: true });

  return {
    ...(order as Order),
    order_items: (items ?? []) as OrderItem[],
  };
}
