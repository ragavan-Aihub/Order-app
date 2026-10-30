'use server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { isSupabaseConfigured } from '@/config/env';
import { createServerSupabaseClient } from '@/services/supabase/server';
import type { AuditAppSource, AuditEntityType, AuditLogRow, AuditReportFilters } from '@/types/audit';
import { istRangeForCustom, istRangeForPreset, type DayRange } from '@/utils/ist-dates';
import { formatOrderNumber } from '@/utils/format';

export type AdminAuditContext = {
  supabase: SupabaseClient;
  businessId: string;
  adminUserId: string;
};

export async function requireAdminAuditContext(): Promise<AdminAuditContext | { error: string }> {
  if (!isSupabaseConfigured) {
    return { error: 'Supabase is not configured.' };
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { error: 'Supabase is not configured.' };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'You are not signed in as an admin.' };
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, business_id')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile || profile.role !== 'admin' || !profile.business_id) {
    return { error: 'You are not signed in as an admin.' };
  }
  return { supabase, businessId: profile.business_id, adminUserId: user.id };
}

export async function logAdminAudit(
  ctx: AdminAuditContext,
  event: {
    action: string;
    entityType: AuditEntityType | string;
    entityId?: string | null;
    summary: string;
    details?: Record<string, unknown> | null;
  },
): Promise<void> {
  if (!isSupabaseConfigured) {
    return;
  }
  const { error } = await ctx.supabase.from('admin_audit_log').insert({
    business_id: ctx.businessId,
    admin_user_id: ctx.adminUserId,
    action: event.action,
    entity_type: event.entityType,
    entity_id: event.entityId ?? null,
    summary: event.summary.slice(0, 500),
    details: { app: 'admin', ...(event.details ?? {}) },
  });
  if (error) {
    console.error('[admin_audit_log]', error.message);
  }
}

function auditRange(filters: AuditReportFilters, now = new Date()): DayRange {
  if (filters.preset === 'custom') {
    return istRangeForCustom(filters.fromYmd, filters.toYmd);
  }
  if (filters.preset === 'today') {
    return istRangeForPreset('today', now);
  }
  if (filters.preset === '30d') {
    return istRangeForPreset('30d', now);
  }
  return istRangeForPreset('7d', now);
}

function appSourceFromAuditRow(summary: string, details: unknown): AuditAppSource {
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    const app = (details as Record<string, unknown>).app;
    if (app === 'delivery') {
      return 'delivery_app';
    }
    if (app === 'admin') {
      return 'admin_panel';
    }
  }
  if (summary.startsWith('[Delivery]')) {
    return 'delivery_app';
  }
  return 'admin_panel';
}

export async function getAdminAuditReport(filters: AuditReportFilters): Promise<{
  ok: true;
  rows: AuditLogRow[];
  range: DayRange;
} | {
  ok: false;
  message: string;
}> {
  const ctx = await requireAdminAuditContext();
  if ('error' in ctx) {
    return { ok: false, message: ctx.error };
  }

  const range = auditRange(filters);
  const needle = filters.query.toLowerCase();

  let auditQuery = ctx.supabase
    .from('admin_audit_log')
    .select('id, action, entity_type, entity_id, summary, details, created_at')
    .eq('business_id', ctx.businessId)
    .gte('created_at', range.startIso)
    .lte('created_at', range.endIso)
    .order('created_at', { ascending: false })
    .limit(500);

  if (filters.entityType !== 'all') {
    auditQuery = auditQuery.eq('entity_type', filters.entityType);
  }

  const { data: auditRows, error: auditError } = await auditQuery;
  if (auditError) {
    return { ok: false, message: auditError.message };
  }

  const { data: modRows, error: modError } = await ctx.supabase
    .from('order_modifications')
    .select('id, order_id, actor_id, reason, previous_total, new_total, created_at')
    .eq('business_id', ctx.businessId)
    .eq('actor_type', 'admin')
    .gte('created_at', range.startIso)
    .lte('created_at', range.endIso)
    .order('created_at', { ascending: false })
    .limit(200);

  if (modError) {
    console.error('[audit report] order_modifications', modError.message);
  }

  const orderIds = [...new Set((modRows ?? []).map((row) => row.order_id))];
  const orderNumberById = new Map<string, number>();
  if (orderIds.length > 0) {
    const { data: orders } = await ctx.supabase
      .from('orders')
      .select('id, order_number')
      .eq('business_id', ctx.businessId)
      .in('id', orderIds);
    for (const o of orders ?? []) {
      orderNumberById.set(o.id, o.order_number);
    }
  }

  const unified: AuditLogRow[] = [];

  for (const row of auditRows ?? []) {
    const appSource = appSourceFromAuditRow(row.summary, row.details);
    if (filters.appSource !== 'all' && appSource !== filters.appSource) {
      continue;
    }
    if (needle && !row.summary.toLowerCase().includes(needle) && !row.action.toLowerCase().includes(needle)) {
      continue;
    }
    unified.push({
      id: row.id,
      source: 'audit_log',
      created_at: row.created_at,
      app_source: appSource,
      action: row.action,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      summary: row.summary,
      order_id: row.entity_type === 'order' ? row.entity_id : null,
      order_number: null,
    });
  }

  for (const row of modRows ?? []) {
    if (filters.entityType !== 'all' && filters.entityType !== 'order') {
      continue;
    }
    const orderNumber = orderNumberById.get(row.order_id) ?? null;
    const reason = row.reason?.trim();
    const summary = reason
      ? `Order #${formatOrderNumber(orderNumber ?? 0)} items updated (${reason})`
      : `Order #${formatOrderNumber(orderNumber ?? 0)} items updated by shop`;
    if (filters.appSource !== 'all' && filters.appSource !== 'admin_panel') {
      continue;
    }
    if (needle && !summary.toLowerCase().includes(needle)) {
      continue;
    }
    unified.push({
      id: row.id,
      source: 'order_modification',
      created_at: row.created_at,
      app_source: 'admin_panel',
      action: row.reason === 'reverted_to_placed' ? 'order.revert_placed' : 'order.items_replace',
      entity_type: 'order',
      entity_id: row.order_id,
      summary,
      order_id: row.order_id,
      order_number: orderNumber,
    });
  }

  const auditOrderIds = unified
    .filter((row) => row.source === 'audit_log' && row.entity_type === 'order' && row.entity_id)
    .map((row) => row.entity_id as string);
  if (auditOrderIds.length > 0) {
    const { data: orderNums } = await ctx.supabase
      .from('orders')
      .select('id, order_number')
      .eq('business_id', ctx.businessId)
      .in('id', [...new Set(auditOrderIds)]);
    const numById = new Map((orderNums ?? []).map((o) => [o.id, o.order_number]));
    for (const row of unified) {
      if (row.source === 'audit_log' && row.entity_type === 'order' && row.entity_id) {
        row.order_id = row.entity_id;
        row.order_number = numById.get(row.entity_id) ?? null;
      }
    }
  }

  unified.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));

  return { ok: true, rows: unified.slice(0, 400), range };
}
