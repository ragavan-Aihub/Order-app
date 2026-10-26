import { getSupabaseClient } from '@/services/supabase';
import type { OrderStatus } from '@/types/order';

const NOTIFY_STATUSES: OrderStatus[] = ['confirmed', 'out_for_delivery', 'delivered'];

/** Best-effort customer push via Edge Function (admin session JWT). */
export async function notifyOrderStatusPush(orderId: string, status: OrderStatus): Promise<void> {
  if (!NOTIFY_STATUSES.includes(status)) {
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return;
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-order-status-push', {
      body: { order_id: orderId, status },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (error) {
      console.warn('[push] send-order-status-push', error.message);
      return;
    }
    if (data && typeof data === 'object' && 'error' in data) {
      console.warn('[push] send-order-status-push', data);
    }
  } catch (error) {
    console.warn('[push] send-order-status-push failed', error);
  }
}
