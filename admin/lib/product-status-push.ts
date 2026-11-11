import { env } from '@/config/env';

/** Best-effort push when a product becomes available. */
export async function notifyProductAvailablePush(
  productId: string,
  accessToken?: string | null,
): Promise<void> {
  const baseUrl = env.supabaseUrl.replace(/\/$/, '');
  const serviceRoleKey = env.supabaseServiceRoleKey.trim();
  const anonKey = env.supabaseAnonKey.trim();
  if (!baseUrl) {
    return;
  }

  const token = serviceRoleKey || accessToken?.trim() || '';
  const apiKey = serviceRoleKey || anonKey;
  if (!token || !apiKey) {
    console.warn('[push] send-product-available-push skipped: set SUPABASE_SERVICE_ROLE_KEY in admin/.env');
    return;
  }

  try {
    const response = await fetch(`${baseUrl}/functions/v1/send-product-available-push`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: apiKey,
      },
      body: JSON.stringify({ product_id: productId }),
    });
    const text = await response.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text.slice(0, 200);
    }
    if (!response.ok) {
      console.warn('[push] send-product-available-push', response.status, payload);
      if (response.status === 401 && accessToken && token !== accessToken) {
        const retry = await fetch(`${baseUrl}/functions/v1/send-product-available-push`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            apikey: anonKey || apiKey,
          },
          body: JSON.stringify({ product_id: productId }),
        });
        const retryText = await retry.text();
        let retryPayload: unknown = retryText;
        try {
          retryPayload = retryText ? JSON.parse(retryText) : null;
        } catch {
          retryPayload = retryText.slice(0, 200);
        }
        if (!retry.ok) {
          console.warn('[push] send-product-available-push retry', retry.status, retryPayload);
          return;
        }
        if (process.env.NODE_ENV !== 'production') {
          console.info('[push] send-product-available-push', retryPayload);
        }
      }
      return;
    }
    if (process.env.NODE_ENV !== 'production') {
      console.info('[push] send-product-available-push', payload);
    }
  } catch (error) {
    console.warn('[push] send-product-available-push failed', error);
  }
}
