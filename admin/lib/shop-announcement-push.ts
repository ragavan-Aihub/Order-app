import { createClient } from '@supabase/supabase-js';

import { env } from '@/config/env';

/** Best-effort announcement push. Returns how many devices were notified, or null if it could not run. */
export async function notifyShopAnnouncement(businessId: string, imageUrls: string[]): Promise<number | null> {
  const baseUrl = env.supabaseUrl.replace(/\/$/, '');
  const serviceRoleKey = env.supabaseServiceRoleKey;
  if (!baseUrl || !serviceRoleKey) {
    return null;
  }

  try {
    const supabase = createClient(baseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.functions.invoke('send-shop-announcement', {
      body: { business_id: businessId, image_urls: imageUrls },
    });
    if (error) {
      console.warn('[push] send-shop-announcement', error.message);
      return null;
    }
    if (!data || typeof data !== 'object') {
      return null;
    }
    if ('error' in data) {
      console.warn('[push] send-shop-announcement', data);
      return null;
    }
    const sent = (data as { sent?: number }).sent;
    return typeof sent === 'number' ? sent : 0;
  } catch (error) {
    console.warn('[push] send-shop-announcement failed', error);
    return null;
  }
}
