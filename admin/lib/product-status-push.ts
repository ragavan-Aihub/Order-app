import { createClient } from '@supabase/supabase-js';

import { env } from '@/config/env';

/** Best-effort push when a product becomes available (requires SUPABASE_SERVICE_ROLE_KEY). */
export async function notifyProductAvailablePush(productId: string): Promise<void> {
  const baseUrl = env.supabaseUrl.replace(/\/$/, '');
  const serviceRoleKey = env.supabaseServiceRoleKey;
  if (!baseUrl || !serviceRoleKey) {
    console.warn('[push] send-product-available-push skipped: set SUPABASE_SERVICE_ROLE_KEY in admin/.env');
    return;
  }

  try {
    const supabase = createClient(baseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.functions.invoke('send-product-available-push', {
      body: { product_id: productId },
    });
    if (error) {
      console.warn('[push] send-product-available-push', error.message);
      return;
    }
    if (data && typeof data === 'object') {
      if ('error' in data) {
        console.warn('[push] send-product-available-push', data);
      } else if (process.env.NODE_ENV !== 'production' && 'sent' in data) {
        console.info('[push] send-product-available-push', data);
      }
    }
  } catch (error) {
    console.warn('[push] send-product-available-push failed', error);
  }
}
