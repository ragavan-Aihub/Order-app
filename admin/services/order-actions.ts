'use server';

import { revalidatePath } from 'next/cache';

import { isSupabaseConfigured } from '@/config/env';
import { createServerSupabaseClient } from '@/services/supabase/server';
import { NEXT_STATUSES, ORDER_STATUSES, type OrderStatus, type PaymentMethod } from '@/types/order';

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
    .select('id, status, payment_method, refund_status')
    .eq('id', orderId)
    .eq('business_id', profile.business_id)
    .maybeSingle();

  if (!current) {
    return { error: 'Could not update this order.' };
  }

  const currentStatus = current.status as OrderStatus;
  if (options?.mode !== 'correct' && !NEXT_STATUSES[currentStatus].includes(status)) {
    return { error: 'That status change is not allowed.' };
  }

  const paid = current.payment_method === 'cash' || current.payment_method === 'upi';
  const refundStatus =
    current.refund_status === 'refunded'
      ? 'refunded'
      : status === 'cancelled' && paid
        ? 'pending'
        : current.refund_status ?? null;

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
  return { error: null };
}

export async function updateOrderPayment(
  orderId: string,
  paymentMethod: PaymentMethod,
): Promise<{ error: string | null }> {
  if (paymentMethod !== 'cash' && paymentMethod !== 'upi') {
    return { error: 'Choose Cash or UPI.' };
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
    .select('id, status, payment_method, refund_status')
    .eq('id', orderId)
    .eq('business_id', profile.business_id)
    .maybeSingle();

  if (!current) {
    return { error: 'Could not update this order.' };
  }

  if (current.payment_method && current.payment_method !== 'pending') {
    return { error: 'Payment mode cannot be changed after it is recorded.' };
  }

  if (current.status === 'cancelled') {
    return { error: 'Cancelled unpaid orders stay Not Applicable.' };
  }

  const { data, error } = await supabase
    .from('orders')
    .update({ payment_method: paymentMethod, refund_status: null })
    .eq('id', orderId)
    .eq('business_id', profile.business_id)
    .eq('payment_method', 'pending')
    .select('id')
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }
  if (!data) {
    return { error: 'Could not update this order.' };
  }

  revalidateOrder(orderId);
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
    .select('id, status, payment_method, refund_status')
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
  return { error: null };
}
