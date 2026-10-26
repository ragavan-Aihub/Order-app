import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const NOTIFY_STATUSES = new Set(['confirmed', 'out_for_delivery', 'delivered']);

type PushPayload = {
  order_id?: string;
  status?: string;
  type?: string;
  record?: { order_id?: string; status?: string; id?: string };
  old_record?: { status?: string };
};

function messageForStatus(status: string, orderNumber: number | null): { title: string; body: string } | null {
  const label = orderNumber != null ? `Order #${orderNumber}` : 'Your order';
  switch (status) {
    case 'confirmed':
      return {
        title: 'Order confirmed',
        body: `${label} is confirmed. The shop is preparing it.`,
      };
    case 'out_for_delivery':
      return {
        title: 'Out for delivery',
        body: `${label} is on its way to you.`,
      };
    case 'delivered':
      return {
        title: 'Delivered',
        body: `${label} has been delivered. Thank you!`,
      };
    default:
      return null;
  }
}

function parseInput(body: PushPayload): { orderId: string; status: string } | null {
  if (body.order_id && body.status) {
    return { orderId: body.order_id, status: body.status };
  }
  const record = body.record;
  if (record?.order_id && record?.status) {
    return { orderId: record.order_id, status: record.status };
  }
  if (record?.id && record?.status && (body.type === 'UPDATE' || body.type === undefined)) {
    return { orderId: record.id, status: record.status };
  }
  return null;
}

function normalizeOrderStatus(status: string): string {
  return status === 'preparing' ? 'confirmed' : status;
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
  orderId: string,
  requestedStatus: string,
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
  if (!profile || profile.role !== 'admin' || !profile.business_id) {
    return jsonResponse({ error: 'Forbidden' }, 403);
  }

  const { data: order, error: orderError } = await userClient
    .from('orders')
    .select('id, business_id, status')
    .eq('id', orderId)
    .maybeSingle();

  if (orderError) {
    return jsonResponse({ error: orderError.message }, 500);
  }
  if (!order || order.business_id !== profile.business_id) {
    return jsonResponse({ error: 'Order not found' }, 404);
  }

  if (normalizeOrderStatus(order.status) !== requestedStatus) {
    return jsonResponse({ error: 'Order status does not match request' }, 409);
  }

  return null;
}

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

async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<void> {
  if (tokens.length === 0) {
    return;
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
        if (ticket.status === 'error') {
          console.error('Expo push ticket error', ticket.message);
        }
      }
    } catch {
      console.error('Expo push unexpected response', text);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonResponse({ error: 'Server not configured' }, 500);
  }

  let body: PushPayload;
  try {
    body = (await req.json()) as PushPayload;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const parsed = parseInput(body);
  if (!parsed) {
    return jsonResponse({ skipped: true, reason: 'missing order_id or status' }, 200);
  }

  const { orderId, status } = parsed;
  if (!NOTIFY_STATUSES.has(status)) {
    return jsonResponse({ skipped: true, reason: 'status not notifiable' }, 200);
  }

  if (body.type === 'UPDATE' && body.old_record?.status === status) {
    return jsonResponse({ skipped: true, reason: 'unchanged status' }, 200);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const serviceCaller = isAuthorizedServiceToken(token, serviceRoleKey, supabaseUrl);
  if (!serviceCaller) {
    const denied = await authorizeAdminJwt(supabaseUrl, anonKey, token, orderId, status);
    if (denied) {
      return denied;
    }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, user_id, order_number, status')
    .eq('id', orderId)
    .maybeSingle();

  if (orderError) {
    return new Response(JSON.stringify({ error: orderError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!order?.user_id) {
    return new Response(
      JSON.stringify({ skipped: true, reason: 'no_app_user', order_id: orderId }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const copy = messageForStatus(status, order.order_number ?? null);
  if (!copy) {
    return new Response(JSON.stringify({ skipped: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: tokenRows, error: tokenError } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', order.user_id);

  if (tokenError) {
    return new Response(JSON.stringify({ error: tokenError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const tokens = (tokenRows ?? []).map((row) => row.token).filter(Boolean);
  await sendExpoPush(tokens, copy.title, copy.body, {
    orderId: order.id,
    status,
  });

  return new Response(
    JSON.stringify({ ok: true, sent: tokens.length, order_id: orderId, status }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
