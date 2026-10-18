import { createClient } from '@supabase/supabase-js';

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
    const supabase = createClient(baseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.functions.invoke('send-order-status-push', {
      body: { order_id: orderId, status },
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
