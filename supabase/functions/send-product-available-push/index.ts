import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function isAuthorizedServiceToken(token: string, configuredKey: string, projectUrl: string): boolean {
  const trimmed = token.trim();
  const expected = configuredKey.trim();
  if (trimmed && expected && trimmed === expected) {
    return true;
  }
  try {
    const segment = trimmed.split('.')[1];
    if (!segment) {
      return false;
    }
    const payload = JSON.parse(
      atob(segment.replace(/-/g, '+').replace(/_/g, '/')),
    ) as { role?: string; ref?: string };
    if (payload.role !== 'service_role') {
      return false;
    }
    const projectRef = new URL(projectUrl).hostname.split('.')[0];
    return payload.ref === projectRef;
  } catch {
    return false;
  }
}

function pushImageUrl(raw: string | null | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }
  const url = raw.trim();
  if (!url.startsWith('https://')) {
    return undefined;
  }
  return url;
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
    const text = await response.text();
    if (!response.ok) {
      console.error('Expo push HTTP error', response.status, text);
      continue;
    }
    try {
      const payload = JSON.parse(text) as { data?: { status?: string; message?: string }[] };
      for (const ticket of payload.data ?? []) {
        if (ticket.status === 'ok') {
          sent += 1;
        } else if (ticket.status === 'error') {
          console.error('Expo push ticket error', ticket.message);
        }
      }
    } catch {
      console.error('Expo push unexpected response', text);
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
  if (!isAuthorizedServiceToken(token, serviceRoleKey, supabaseUrl)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body: { product_id?: string };
  try {
    body = (await req.json()) as { product_id?: string };
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const productId = body.product_id?.trim();
  if (!productId) {
    return new Response(JSON.stringify({ skipped: true, reason: 'missing product_id' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, name, available, image_url')
    .eq('id', productId)
    .maybeSingle();

  if (productError) {
    return new Response(JSON.stringify({ error: productError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!product) {
    return new Response(JSON.stringify({ error: 'Product not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (product.available !== true) {
    return new Response(JSON.stringify({ skipped: true, reason: 'product_not_available' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: interests, error: interestError } = await supabase
    .from('product_notify_interests')
    .select('user_id')
    .eq('product_id', productId);

  if (interestError) {
    return new Response(JSON.stringify({ error: interestError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userIds = [...new Set((interests ?? []).map((row) => row.user_id).filter(Boolean))];
  const interested = userIds.length;

  const tokens: string[] = [];
  for (const userId of userIds) {
    const { data: tokenRows, error: tokenError } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', userId);
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

  const title = 'Now Available!';
  const pushBody = `${product.name} is back! It's now available to order. Tap to order yours.`;
  const imageUrl = pushImageUrl((product as { image_url?: string | null }).image_url);
  const sent = await sendExpoPush(
    tokens,
    title,
    pushBody,
    {
      productId: String(product.id),
      screen: 'home',
    },
    imageUrl,
  );

  await supabase.from('product_notify_interests').delete().eq('product_id', productId);

  return new Response(
    JSON.stringify({ ok: true, sent, interested, product_id: productId }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
