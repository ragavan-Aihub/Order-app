import { env } from '@/config/env';
import type { OrderStatus } from '@/types/order';

const NOTIFY_STATUSES: OrderStatus[] = ['confirmed', 'out_for_delivery', 'delivered'];

async function postOrderStatusPush(
  baseUrl: string,
  token: string,
  apiKey: string,
  orderId: string,
  status: OrderStatus,
): Promise<{ ok: boolean; status: number; payload: unknown }> {
  const response = await fetch(`${baseUrl}/functions/v1/send-order-status-push`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: apiKey,
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
  return { ok: response.ok, status: response.status, payload };
}

/** Best-effort customer push after an order status change. */
export async function notifyOrderStatusPush(
  orderId: string,
  status: OrderStatus,
  accessToken?: string | null,
): Promise<void> {
  if (!NOTIFY_STATUSES.includes(status)) {
    return;
  }
  const baseUrl = env.supabaseUrl.replace(/\/$/, '');
  const serviceRoleKey = env.supabaseServiceRoleKey.trim();
  const anonKey = env.supabaseAnonKey.trim();
  if (!baseUrl) {
    return;
  }

  const token = serviceRoleKey || accessToken?.trim() || '';
  const apiKey = serviceRoleKey || anonKey;
  if (!token || !apiKey) {
    console.warn('[push] send-order-status-push skipped: set SUPABASE_SERVICE_ROLE_KEY in admin/.env');
    return;
  }

  try {
    const result = await postOrderStatusPush(baseUrl, token, apiKey, orderId, status);
    if (!result.ok) {
      console.warn('[push] send-order-status-push', result.status, result.payload);
      if (result.status === 401 && accessToken && token !== accessToken) {
        const retry = await postOrderStatusPush(baseUrl, accessToken, anonKey || apiKey, orderId, status);
        if (!retry.ok) {
          console.warn('[push] send-order-status-push retry', retry.status, retry.payload);
          return;
        }
        if (process.env.NODE_ENV !== 'production') {
          console.info('[push] send-order-status-push', retry.payload);
        }
        return;
      }
      return;
    }
    if (process.env.NODE_ENV !== 'production') {
      console.info('[push] send-order-status-push', result.payload);
    }
  } catch (error) {
    console.warn('[push] send-order-status-push failed', error);
  }
}
