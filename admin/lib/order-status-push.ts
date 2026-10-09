import { env } from '@/config/env';
import type { OrderStatus } from '@/types/order';

const NOTIFY_STATUSES: OrderStatus[] = ['confirmed', 'out_for_delivery', 'delivered'];

/** Best-effort push via Supabase Edge Function (requires SUPABASE_SERVICE_ROLE_KEY on the admin server). */
export async function notifyOrderStatusPush(orderId: string, status: OrderStatus): Promise<void> {
  if (!NOTIFY_STATUSES.includes(status)) {
    return;
  }
  const baseUrl = env.supabaseUrl.replace(/\/$/, '');
  const serviceRoleKey = env.supabaseServiceRoleKey;
  if (!baseUrl || !serviceRoleKey) {
    return;
  }

  try {
    const response = await fetch(`${baseUrl}/functions/v1/send-order-status-push`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ order_id: orderId, status }),
    });
    if (!response.ok) {
      console.warn('[push] send-order-status-push', response.status, await response.text());
    }
  } catch (error) {
    console.warn('[push] send-order-status-push failed', error);
  }
}
