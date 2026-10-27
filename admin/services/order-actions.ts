'use server';

import { revalidatePath } from 'next/cache';

import { isSupabaseConfigured } from '@/config/env';
import { notifyOrderStatusPush } from '@/lib/order-status-push';
import { logAdminAudit } from '@/services/admin-audit';
import { createServerSupabaseClient } from '@/services/supabase/server';
import { NEXT_STATUSES, ORDER_STATUSES, type OrderStatus, type PaymentMethod } from '@/types/order';
import { formatOrderNumber } from '@/utils/format';

function revalidateOrder(orderId: string) {
  revalidatePath('/');
  revalidatePath('/orders');
  revalidatePath(`/orders/${orderId}`);
  revalidatePath('/customers');
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  options?: { mode?: 'normal' | 'correct'; cancelReason?: string | null },
): Promise<{ error: string | null }> {
  if (!ORDER_STATUSES.some((item) => item.value === status)) {
    return { error: 'Invalid status.' };
  }

  const cancelReason = options?.cancelReason?.trim() || null;
  if (status === 'cancelled' && !cancelReason) {
    return { error: 'Choose a cancellation reason.' };
  }

  if (!isSupabaseConfigured) {
    return { error: 'Supabase is not configured.' };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { error: 'Supabase is not configured.' };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
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

  const { data: current } = await supabase
    .from('orders')
    .select('id, status, payment_method, refund_status, order_number')
    .eq('id', orderId)
    .eq('business_id', profile.business_id)
    .maybeSingle();

  if (!current) {
    return { error: 'Could not update this order.' };
  }

  const currentStatus = (current.status === 'preparing' ? 'confirmed' : current.status) as OrderStatus;
  if (options?.mode !== 'correct' && !NEXT_STATUSES[currentStatus].includes(status)) {
    return { error: 'That status change is not allowed.' };
  }

  const paid = current.payment_method === 'cash' || current.payment_method === 'upi';
  let refundStatus = current.refund_status ?? null;
  if (status === 'cancelled' && paid && refundStatus !== 'refunded') {
    refundStatus = 'pending';
  }
  if (status !== 'cancelled' && refundStatus !== 'refunded') {
    refundStatus = null;
  }

  const { data, error } = await supabase
    .from('orders')
    .update({
      status,
      cancel_reason: status === 'cancelled' ? cancelReason : null,
      refund_status: refundStatus,
    })
    .eq('id', orderId)
    .eq('business_id', profile.business_id)
    .select('id')
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }
  if (!data) {
    return { error: 'Could not update this order.' };
  }

  revalidateOrder(orderId);
  void notifyOrderStatusPush(orderId, status);
  const orderLabel = formatOrderNumber(current.order_number ?? 0);
  await logAdminAudit(
    { supabase, businessId: profile.business_id, adminUserId: user.id },
    {
      action: options?.mode === 'correct' ? 'order.status_correct' : 'order.status_update',
      entityType: 'order',
      entityId: orderId,
      summary:
        options?.mode === 'correct'
          ? `Order #${orderLabel} status corrected to ${status}`
          : `Order #${orderLabel} → ${status}`,
      details: { from: currentStatus, to: status, cancel_reason: cancelReason },
    },
  );
  return { error: null };
}

export async function updateOrderPayment(
  orderId: string,
  paymentMethod: PaymentMethod,
): Promise<{ error: string | null }> {
  if (paymentMethod !== 'cash' && paymentMethod !== 'upi' && paymentMethod !== 'pending') {
    return { error: 'Choose Cash, UPI or Not yet.' };
  }

  if (!isSupabaseConfigured) {
    return { error: 'Supabase is not configured.' };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { error: 'Supabase is not configured.' };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
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

  const { data: current } = await supabase
    .from('orders')
    .select('id, status, payment_method, refund_status, order_number')
    .eq('id', orderId)
    .eq('business_id', profile.business_id)
    .maybeSingle();

  if (!current) {
    return { error: 'Could not update this order.' };
  }

  if (current.status === 'cancelled') {
    const collected = current.payment_method === 'cash' || current.payment_method === 'upi';
    return {
      error: collected
        ? 'Use Mark refunded for paid cancelled orders.'
        : 'Cancelled unpaid orders stay Not Applicable.',
    };
  }

  const { data, error } = await supabase
    .from('orders')
    .update({ payment_method: paymentMethod, refund_status: null })
    .eq('id', orderId)
    .eq('business_id', profile.business_id)
    .select('id')
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }
  if (!data) {
    return { error: 'Could not update this order.' };
  }

  revalidateOrder(orderId);
  await logAdminAudit(
    { supabase, businessId: profile.business_id, adminUserId: user.id },
    {
      action: 'order.payment_update',
      entityType: 'order',
      entityId: orderId,
      summary: `Order #${formatOrderNumber(current.order_number ?? 0)} payment → ${paymentMethod}`,
      details: { from: current.payment_method, to: paymentMethod },
    },
  );
  return { error: null };
}

export async function updateOrderRefund(orderId: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) {
    return { error: 'Supabase is not configured.' };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { error: 'Supabase is not configured.' };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
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

  const { data: current } = await supabase
    .from('orders')
    .select('id, status, payment_method, refund_status, order_number')
    .eq('id', orderId)
    .eq('business_id', profile.business_id)
    .maybeSingle();

  if (!current) {
    return { error: 'Could not update this order.' };
  }

  const paid = current.payment_method === 'cash' || current.payment_method === 'upi';
  if (current.status !== 'cancelled' || !paid) {
    return { error: 'Refund applies only to paid cancelled orders.' };
  }
  if (current.refund_status === 'refunded') {
    return { error: 'Refund is already recorded.' };
  }

  const { data, error } = await supabase
    .from('orders')
    .update({ refund_status: 'refunded' })
    .eq('id', orderId)
    .eq('business_id', profile.business_id)
    .select('id')
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }
  if (!data) {
    return { error: 'Could not update this order.' };
  }

  revalidateOrder(orderId);
  await logAdminAudit(
    { supabase, businessId: profile.business_id, adminUserId: user.id },
    {
      action: 'order.refund_marked',
      entityType: 'order',
      entityId: orderId,
      summary: `Order #${formatOrderNumber(current.order_number ?? 0)} marked refunded`,
    },
  );
  return { error: null };
}

export async function replaceAdminOrderItems(
  orderId: string,
  items: Array<{ productId: string; quantity: number }>,
  options?: {
    reason?: string | null;
    expectedRevision?: number | null;
    relaxedValidation?: boolean;
  },
): Promise<{ error: string | null; conflict?: boolean }> {
  if (!items.length) {
    return { error: 'Add at least one item.' };
  }
  if (items.some((item) => item.quantity < 1 || item.quantity > 10)) {
    return { error: 'Each item quantity must be between 1 and 10.' };
  }
  if (items.length > 15) {
    return { error: 'You can add up to 15 items in one order.' };
  }

  if (!isSupabaseConfigured) {
    return { error: 'Supabase is not configured.' };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { error: 'Supabase is not configured.' };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
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

  const payload = items.map((item) => ({
    product_id: item.productId,
    quantity: item.quantity,
  }));

  const { error } = await supabase.rpc('admin_replace_order_items', {
    p_order_id: orderId,
    p_items: payload,
    p_reason: options?.reason?.trim() || null,
    p_expected_items_revision: options?.expectedRevision ?? null,
    p_relaxed_validation: options?.relaxedValidation ?? false,
  });

  if (error) {
    if (/ORDER_STALE/i.test(error.message)) {
      return {
        error: 'This order was updated elsewhere. Reload the page and try again.',
        conflict: true,
      };
    }
    return { error: error.message };
  }

  revalidateOrder(orderId);
  return { error: null };
}

export async function revertAdminOrderToPlaced(
  orderId: string,
  expectedRevision?: number | null,
): Promise<{ error: string | null; conflict?: boolean }> {
  if (!isSupabaseConfigured) {
    return { error: 'Supabase is not configured.' };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { error: 'Supabase is not configured.' };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
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

  const { error } = await supabase.rpc('admin_revert_order_to_placed', {
    p_order_id: orderId,
    p_expected_items_revision: expectedRevision ?? null,
  });

  if (error) {
    if (/ORDER_STALE/i.test(error.message)) {
      return {
        error: 'This order was updated elsewhere. Reload the page and try again.',
        conflict: true,
      };
    }
    return { error: error.message };
  }

  revalidateOrder(orderId);
  return { error: null };
}
