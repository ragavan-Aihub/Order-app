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

function isAuthorizedServiceToken(token: string, configuredKey: string): boolean {
  const trimmed = token.trim();
  const expected = configuredKey.trim();
  if (!trimmed || !expected) {
    return false;
  }
  return sameSecret(trimmed, expected);
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function authorizeAdminJwt(
  supabaseUrl: string,
  anonKey: string,
  accessToken: string,
  businessId: string,
): Promise<Response | null> {
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
  const userId = userData.user?.id;
  if (userError || !userId) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }
  const { data: profile, error: profileError } = await userClient
    .from('profiles')
    .select('role, business_id')
    .eq('id', userId)
    .maybeSingle();
  if (profileError) {
    return jsonResponse({ error: profileError.message }, 500);
  }
  if (!profile || profile.role !== 'admin' || profile.business_id !== businessId) {
    return jsonResponse({ error: 'Forbidden' }, 403);
  }
  return null;
}

async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<number> {
  if (tokens.length === 0) {
    return 0;
  }
  const messages = tokens.map((to) => ({
    to,
    sound: 'default',
    title,
    body,
    data,
    priority: 'high',
    channelId: 'order-updates',
  }));

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
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500 });
  }

  let body: { broadcast_id?: string; business_id?: string };
  try {
    body = (await req.json()) as { broadcast_id?: string; business_id?: string };
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const broadcastId = body.broadcast_id?.trim();
  const businessId = body.business_id?.trim();
  if (!broadcastId || !businessId) {
    return new Response(JSON.stringify({ error: 'broadcast_id and business_id are required' }), { status: 400 });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }
  if (!isAuthorizedServiceToken(token, serviceRoleKey)) {
    if (!anonKey) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    const denied = await authorizeAdminJwt(supabaseUrl, anonKey, token, businessId);
    if (denied) {
      return denied;
    }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: broadcast, error: broadcastError } = await supabase
    .from('inbox_broadcasts')
    .select('id, business_id, title, body, category')
    .eq('id', broadcastId)
    .eq('business_id', businessId)
    .maybeSingle();

  if (broadcastError) {
    return new Response(JSON.stringify({ error: broadcastError.message }), { status: 500 });
  }
  if (!broadcast) {
    return new Response(JSON.stringify({ error: 'Broadcast not found' }), { status: 404 });
  }

  const { data: rows, error: inboxError } = await supabase
    .from('customer_inbox')
    .select('user_id')
    .eq('broadcast_id', broadcastId);

  if (inboxError) {
    return new Response(JSON.stringify({ error: inboxError.message }), { status: 500 });
  }

  const userIds = [...new Set((rows ?? []).map((row) => row.user_id).filter(Boolean))];
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
  const sent = await sendExpoPush(uniqueTokens, broadcast.title, broadcast.body, {
    screen: 'notifications',
    category: broadcast.category,
    broadcastId,
  });

  await supabase.from('inbox_broadcasts').update({ push_sent: sent }).eq('id', broadcastId);

  return new Response(JSON.stringify({ ok: true, sent, customers: userIds.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
