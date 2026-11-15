import { createClient } from '@supabase/supabase-js';

import { env } from '@/config/env';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string>,
  image?: string | null,
): Promise<number> {
  if (tokens.length === 0) {
    return 0;
  }
  const picture = image?.trim() || undefined;
  const messages = tokens.map((to) => ({
    to,
    sound: 'default',
    title,
    body,
    data,
    priority: 'high',
    channelId: 'order-updates',
    ...(picture ? { image: picture, richContent: { image: picture } } : {}),
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
      console.warn('[push] Expo HTTP', response.status, await response.text());
      continue;
    }
    const payload = (await response.json()) as { data?: { status?: string; message?: string }[] };
    for (const ticket of payload.data ?? []) {
      if (ticket.status === 'ok') {
        sent += 1;
      } else if (ticket.status === 'error') {
        console.warn('[push] Expo ticket', ticket.message);
      }
    }
  }
  return sent;
}

/** Send Expo alerts from the admin server (does not use the Edge Function). */
export async function notifyInboxBroadcast(
  businessId: string,
  broadcastId: string,
  _accessToken?: string | null,
): Promise<{ sent: number | null; detail?: string }> {
  const baseUrl = env.supabaseUrl.replace(/\/$/, '');
  const serviceRoleKey = env.supabaseServiceRoleKey.trim();
  if (!baseUrl || !serviceRoleKey) {
    return { sent: null, detail: 'Service role key is missing in admin/.env.' };
  }

  const supabase = createClient(baseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: broadcast, error: broadcastError } = await supabase
    .from('inbox_broadcasts')
    .select('id, title, body, category')
    .eq('id', broadcastId)
    .eq('business_id', businessId)
    .maybeSingle();

  if (broadcastError) {
    return { sent: null, detail: broadcastError.message };
  }
  if (!broadcast) {
    return { sent: null, detail: 'Broadcast not found.' };
  }

  const { data: rows, error: inboxError } = await supabase
    .from('customer_inbox')
    .select('id, user_id')
    .eq('broadcast_id', broadcastId);

  if (inboxError) {
    return { sent: null, detail: inboxError.message };
  }

  const inboxByUser = new Map<string, string>();
  for (const row of rows ?? []) {
    if (row.user_id && row.id && !inboxByUser.has(row.user_id)) {
      inboxByUser.set(row.user_id, row.id);
    }
  }
  const userIds = [...inboxByUser.keys()];
  const tokensByUser = new Map<string, string[]>();
  for (let i = 0; i < userIds.length; i += 100) {
    const slice = userIds.slice(i, i + 100);
    const { data: tokenRows, error: tokenError } = await supabase
      .from('push_tokens')
      .select('token, user_id')
      .in('user_id', slice);
    if (tokenError) {
      return { sent: null, detail: tokenError.message };
    }
    for (const row of tokenRows ?? []) {
      if (!row.token || !row.user_id) {
        continue;
      }
      const list = tokensByUser.get(row.user_id) ?? [];
      list.push(row.token);
      tokensByUser.set(row.user_id, list);
    }
  }

  const { data: shop } = await supabase
    .from('businesses')
    .select('app_icon_url, logo_url')
    .eq('id', businessId)
    .maybeSingle();
  const picture = shop?.app_icon_url || shop?.logo_url || null;

  let sent = 0;
  let tokenCount = 0;
  for (const [userId, tokens] of tokensByUser) {
    const inboxId = inboxByUser.get(userId);
    const uniqueTokens = [...new Set(tokens)];
    tokenCount += uniqueTokens.length;
    sent += await sendExpoPush(
      uniqueTokens,
      broadcast.title,
      broadcast.body,
      {
        screen: 'notification',
        category: broadcast.category,
        broadcastId,
        ...(inboxId ? { inboxId } : {}),
      },
      picture,
    );
  }

  await supabase.from('inbox_broadcasts').update({ push_sent: sent }).eq('id', broadcastId);

  if (tokenCount === 0) {
    return { sent: 0, detail: 'No customer devices have notifications turned on.' };
  }
  return { sent };
}
