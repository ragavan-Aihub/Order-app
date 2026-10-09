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
    if (!response.ok) {
      const text = await response.text();
      console.error('Expo push failed', response.status, text);
    }
  }
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
  if (token !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body: PushPayload;
  try {
    body = (await req.json()) as PushPayload;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const parsed = parseInput(body);
  if (!parsed) {
    return new Response(JSON.stringify({ skipped: true, reason: 'missing order_id or status' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { orderId, status } = parsed;
  if (!NOTIFY_STATUSES.has(status)) {
    return new Response(JSON.stringify({ skipped: true, reason: 'status not notifiable' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (body.type === 'UPDATE' && body.old_record?.status === status) {
    return new Response(JSON.stringify({ skipped: true, reason: 'unchanged status' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, user_id, order_number, status')
    .eq('id', orderId)
    .maybeSingle();

  if (orderError || !order?.user_id) {
    return new Response(JSON.stringify({ error: orderError?.message ?? 'Order not found' }), {
      status: orderError ? 500 : 404,
      headers: { 'Content-Type': 'application/json' },
    });
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
