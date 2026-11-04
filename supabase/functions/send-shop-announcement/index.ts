import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function sameSecret(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  const length = Math.max(a.length, b.length);
  let mismatch = a.length === b.length ? 0 : 1;
  for (let i = 0; i < length; i += 1) {
    mismatch |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return mismatch === 0;
}

/** Only the server's service-role key. A forged JWT payload is not accepted. */
function isAuthorizedServiceToken(token: string, configuredKey: string): boolean {
  const trimmed = token.trim();
  const expected = configuredKey.trim();
  if (!trimmed || !expected) {
    return false;
  }
  return sameSecret(trimmed, expected);
}

function pushImageUrl(raw: string | null | undefined): string | undefined {
  const url = raw?.trim() ?? '';
  return url.startsWith('https://') ? url : undefined;
}

async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string>,
  imageUrl?: string,
): Promise<number> {
  if (tokens.length === 0) {
    return 0;
  }
  const messages = tokens.map((to) => {
    const message: Record<string, unknown> = {
      to,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high',
      channelId: 'order-updates',
    };
    if (imageUrl) {
      message.richContent = { image: imageUrl };
    }
    return message;
  });

  let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chunk),
    });
    if (!response.ok) {
      console.error('Expo push HTTP error', response.status, await response.text());
      continue;
    }
    const payload = (await response.json()) as { data?: { status?: string; message?: string }[] };
    for (const ticket of payload.data ?? []) {
      if (ticket.status === 'ok') {
        sent += 1;
      } else if (ticket.status === 'error') {
        console.error('Expo push ticket error', ticket.message);
      }
    }
  }
  return sent;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500 });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!isAuthorizedServiceToken(token, serviceRoleKey)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body: { business_id?: string; image_urls?: unknown };
  try {
    body = (await req.json()) as { business_id?: string; image_urls?: unknown };
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const businessId = body.business_id?.trim();
  if (!businessId) {
    return new Response(JSON.stringify({ error: 'business_id is required' }), { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: shop, error: shopError } = await supabase
    .from('businesses')
    .select('announcement_active, announcement_title, announcement_body, announcement_image_url')
    .eq('id', businessId)
    .maybeSingle();

  if (shopError) {
    return new Response(JSON.stringify({ error: shopError.message }), { status: 500 });
  }
  if (!shop?.announcement_active) {
    return new Response(JSON.stringify({ skipped: true, reason: 'announcement_off' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: banners } = await supabase
    .from('shop_banners')
    .select('image_url')
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true });
  const allowed = new Set(
    (banners ?? [])
      .map((row) => (typeof row.image_url === 'string' ? row.image_url.trim() : ''))
      .filter((url) => url.startsWith('https://')),
  );
  const requested = Array.isArray(body.image_urls)
    ? body.image_urls
        .filter((url): url is string => typeof url === 'string')
        .map((url) => url.trim())
        .filter((url) => allowed.has(url))
    : [];
  const posterUrls = (
    requested.length > 0
      ? [...new Set(requested)]
      : [pushImageUrl((banners?.[0]?.image_url as string | undefined) || (shop.announcement_image_url as string | null))].filter(
          (url): url is string => Boolean(url),
        )
  ).slice(0, 8);
  if (posterUrls.length === 0) {
    return new Response(JSON.stringify({ skipped: true, reason: 'no_poster' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const title = 'Shop update';
  const pushBody = 'Open the app to see the latest poster.';

  const { data: customers, error: customerError } = await supabase
    .from('profiles')
    .select('id')
    .eq('business_id', businessId)
    .eq('role', 'customer');

  if (customerError) {
    return new Response(JSON.stringify({ error: customerError.message }), { status: 500 });
  }

  const userIds = (customers ?? []).map((row) => row.id).filter(Boolean);
  const tokens: string[] = [];
  for (let i = 0; i < userIds.length; i += 100) {
    const slice = userIds.slice(i, i + 100);
    const { data: tokenRows, error: tokenError } = await supabase
      .from('push_tokens')
      .select('token')
      .in('user_id', slice);
    if (tokenError) {
      console.error('push_tokens read', tokenError.message);
      continue;
    }
    for (const row of tokenRows ?? []) {
      if (row.token) {
        tokens.push(row.token);
      }
    }
  }

  const uniqueTokens = [...new Set(tokens)];
  let sent = 0;
  for (const posterUrl of posterUrls) {
    sent = Math.max(
      sent,
      await sendExpoPush(uniqueTokens, title, pushBody, { screen: 'home', announcement: '1' }, posterUrl),
    );
  }

  return new Response(JSON.stringify({ ok: true, sent, alerts: posterUrls.length, customers: userIds.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
