import type { SupabaseClient } from '@supabase/supabase-js';

export async function logDeliveryAudit(
  supabase: SupabaseClient,
  businessId: string,
  event: {
    action: string;
    entityType: 'order';
    entityId: string;
    summary: string;
    details?: Record<string, unknown> | null;
  },
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return;
  }

  const { error } = await supabase.from('admin_audit_log').insert({
    business_id: businessId,
    admin_user_id: user.id,
    action: event.action,
    entity_type: event.entityType,
    entity_id: event.entityId,
    summary: event.summary.slice(0, 500),
    details: { app: 'delivery', ...(event.details ?? {}) },
  });
  if (error) {
    console.warn('[admin_audit_log]', error.message);
  }
}
