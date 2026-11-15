'use server';

import { revalidatePath } from 'next/cache';

import { notifyInboxBroadcast } from '@/lib/inbox-push';
import { logAdminAudit, requireAdminAuditContext } from '@/services/admin-audit';

export type InboxBroadcastRow = {
  id: string;
  category: string;
  title: string;
  body: string;
  recipient_count: number;
  push_sent: number | null;
  created_at: string;
};

export async function listInboxBroadcasts(): Promise<InboxBroadcastRow[]> {
  const ctx = await requireAdminAuditContext();
  if ('error' in ctx) {
    return [];
  }
  const { data } = await ctx.supabase
    .from('inbox_broadcasts')
    .select('id, category, title, body, recipient_count, push_sent, created_at')
    .eq('business_id', ctx.businessId)
    .order('created_at', { ascending: false })
    .limit(30);
  return (data ?? []) as InboxBroadcastRow[];
}

export async function sendInboxBroadcast(input: {
  title: string;
  body: string;
  category: 'offers' | 'updates';
}): Promise<{ error: string | null; recipients?: number; pushSent?: number | null; pushDetail?: string }> {
  const ctx = await requireAdminAuditContext();
  if ('error' in ctx) {
    return { error: ctx.error };
  }

  const { data, error } = await ctx.supabase.rpc('admin_broadcast_inbox', {
    p_title: input.title,
    p_body: input.body,
    p_category: input.category,
  });

  if (error) {
    return { error: error.message };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const broadcastId = row?.broadcast_id as string | undefined;
  const recipients = Number(row?.recipient_count ?? 0);
  if (!broadcastId) {
    return { error: 'Could not save this message.' };
  }

  const push = await notifyInboxBroadcast(ctx.businessId, broadcastId);

  await logAdminAudit(ctx, {
    action: 'inbox.broadcast',
    entityType: 'business',
    entityId: ctx.businessId,
    summary: `Sent ${input.category} notification: ${input.title.trim()}`,
    details: { broadcastId, recipients, pushSent: push.sent },
  });

  revalidatePath('/settings/announcements');
  revalidatePath('/settings/notifications');
  return { error: null, recipients, pushSent: push.sent, pushDetail: push.detail };
}
