import { env } from '@/config/env';
import { getSupabaseClient } from '@/services/supabase';
import type { OrderStatus } from '@/types/order';

const NOTIFY_STATUSES: OrderStatus[] = ['confirmed', 'out_for_delivery', 'delivered'];

/** Best-effort customer push via Edge Function (admin session JWT). */
export async function notifyOrderStatusPush(orderId: string, status: OrderStatus): Promise<void> {
  if (!NOTIFY_STATUSES.includes(status)) {
    return;
  }

  const supabase = getSupabaseClient();
  const baseUrl = env.supabaseUrl.replace(/\/$/, '');
  const anonKey = env.supabaseAnonKey.trim();
  if (!supabase || !baseUrl || !anonKey) {
    return;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return;
  }

  try {
    const response = await fetch(`${baseUrl}/functions/v1/send-order-status-push`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ order_id: orderId, status }),
    });
    const text = await response.text();
    let payload: unknown = text.slice(0, 200);
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text.slice(0, 200);
    }
    if (!response.ok) {
      console.warn('[push] send-order-status-push', response.status, payload);
      return;
    }
    if (__DEV__ && payload && typeof payload === 'object' && 'error' in payload) {
      console.warn('[push] send-order-status-push', payload);
    }
  } catch (error) {
    console.warn('[push] send-order-status-push failed', error);
  }
}
