import { getSupabaseClient } from '@/services/supabase';

export type InboxCategory = 'orders' | 'offers' | 'updates';

export type InboxItem = {
  id: string;
  category: InboxCategory;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

function asCategory(value: unknown): InboxCategory {
  if (value === 'offers' || value === 'updates' || value === 'orders') {
    return value;
  }
  return 'updates';
}

export async function fetchInbox(): Promise<InboxItem[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from('customer_inbox')
    .select('id, category, title, body, data, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error || !data) {
    return [];
  }
  return data.map((row) => ({
    id: row.id,
    category: asCategory(row.category),
    title: row.title,
    body: row.body,
    data: (row.data && typeof row.data === 'object' ? row.data : {}) as Record<string, unknown>,
    read_at: row.read_at,
    created_at: row.created_at,
  }));
}

export async function fetchInboxUnreadCount(): Promise<number> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return 0;
  }
  const { data, error } = await supabase.rpc('my_inbox_unread_count');
  if (error) {
    return 0;
  }
  const count = Number(data);
  return Number.isFinite(count) ? Math.max(0, count) : 0;
}

export async function fetchInboxIdByBroadcast(broadcastId: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from('customer_inbox')
    .select('id')
    .eq('broadcast_id', broadcastId)
    .maybeSingle();
  if (error || !data?.id) {
    return null;
  }
  return data.id;
}

export async function fetchInboxItem(id: string): Promise<InboxItem | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from('customer_inbox')
    .select('id, category, title, body, data, read_at, created_at')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return {
    id: data.id,
    category: asCategory(data.category),
    title: data.title,
    body: data.body,
    data: (data.data && typeof data.data === 'object' ? data.data : {}) as Record<string, unknown>,
    read_at: data.read_at,
    created_at: data.created_at,
  };
}

export async function markInboxRead(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }
  await supabase.rpc('mark_inbox_read', { p_id: id });
}

export async function markAllInboxRead(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }
  await supabase.rpc('mark_all_inbox_read');
}
