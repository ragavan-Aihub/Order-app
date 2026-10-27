import { enrichDeliveryOrderItems } from '@/services/order-item-images';
import { notifyOrderStatusPush } from '@/services/order-status-push';
import { getSupabaseClient } from '@/services/supabase';
import { istTodayBounds } from '@/utils/ist-dates';
import {
  NEXT_STATUSES,
  type Order,
  type OrderStatus,
  type OrderWithItems,
  type PaymentMethod,
} from '@/types/order';

/** Same queue as admin “Pending delivery”: new + confirmed + out for delivery (any date). */
const LIST_STATUSES: OrderStatus[] = ['new', 'confirmed', 'out_for_delivery'];

export async function listDeliveryOrders(businessId: string): Promise<Order[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, business_id, customer_name, mobile, delivery_address, pincode, total_amount, status, payment_method, cancel_reason, created_at, updated_at',
    )
    .eq('business_id', businessId)
    .in('status', LIST_STATUSES)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Order[];
}

/** Delivered today (IST), by `updated_at` when marked delivered — for end-of-day cross-check. */
export async function listTodayDeliveredOrders(businessId: string): Promise<Order[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { startIso, endIso } = istTodayBounds();

  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, business_id, customer_name, mobile, delivery_address, pincode, total_amount, status, payment_method, cancel_reason, created_at, updated_at',
    )
    .eq('business_id', businessId)
    .eq('status', 'delivered')
    .gte('updated_at', startIso)
    .lte('updated_at', endIso)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Order[];
}

export async function getDeliveryOrder(orderId: string, businessId: string): Promise<OrderWithItems | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from('orders')
    .select(
      `
      id, order_number, business_id, customer_name, mobile, delivery_address, pincode, total_amount, status, payment_method, cancel_reason, created_at, updated_at,
      order_items ( id, product_id, product_name, quantity, subtotal )
    `,
    )
    .eq('id', orderId)
    .eq('business_id', businessId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as OrderWithItems & { order_items: OrderWithItems['order_items'] | null };
  const items = await enrichDeliveryOrderItems(businessId, row.order_items ?? []);
  return {
    ...row,
    order_items: items,
  };
}

export async function updateDeliveryOrderStatus(
  orderId: string,
  businessId: string,
  status: OrderStatus,
): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { error: 'Supabase is not configured.' };
  }

  const { data: current, error: fetchError } = await supabase
    .from('orders')
    .select('id, status, payment_method, refund_status')
    .eq('id', orderId)
    .eq('business_id', businessId)
    .maybeSingle();

  if (fetchError) {
    return { error: fetchError.message };
  }
  if (!current) {
    return { error: 'Could not find this order.' };
  }

  const rawStatus = current.status as string;
  const currentStatus = (rawStatus === 'preparing' ? 'confirmed' : current.status) as OrderStatus;
  if (!NEXT_STATUSES[currentStatus].includes(status)) {
    return { error: 'That status change is not allowed.' };
  }

  const paid = current.payment_method === 'cash' || current.payment_method === 'upi';
  let refundStatus = (current.refund_status as string | null) ?? null;
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
      cancel_reason: status === 'cancelled' ? 'Could not deliver' : null,
      refund_status: refundStatus,
    })
    .eq('id', orderId)
    .eq('business_id', businessId)
    .select('id')
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }
  if (!data) {
    return { error: 'Could not update this order.' };
  }

  void notifyOrderStatusPush(orderId, status);
  return { error: null };
}

export async function updateDeliveryOrderPayment(
  orderId: string,
  businessId: string,
  paymentMethod: PaymentMethod,
): Promise<{ error: string | null }> {
  if (paymentMethod !== 'cash' && paymentMethod !== 'upi' && paymentMethod !== 'pending') {
    return { error: 'Choose Cash, UPI or Not yet.' };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { error: 'Supabase is not configured.' };
  }

  const { data: current, error: fetchError } = await supabase
    .from('orders')
    .select('id, status, payment_method, refund_status')
    .eq('id', orderId)
    .eq('business_id', businessId)
    .maybeSingle();

  if (fetchError) {
    return { error: fetchError.message };
  }
  if (!current) {
    return { error: 'Could not update this order.' };
  }

  if (current.status === 'cancelled') {
    return { error: 'Cannot record payment on a cancelled order.' };
  }

  const { data, error } = await supabase
    .from('orders')
    .update({ payment_method: paymentMethod, refund_status: null })
    .eq('id', orderId)
    .eq('business_id', businessId)
    .select('id')
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }
  if (!data) {
    return { error: 'Could not update this order.' };
  }

  return { error: null };
}

export async function deliverOrderWithPayment(
  orderId: string,
  businessId: string,
  payment: 'cash' | 'upi' | 'pending',
): Promise<{ error: string | null }> {
  const statusResult = await updateDeliveryOrderStatus(orderId, businessId, 'delivered');
  if (statusResult.error) {
    return statusResult;
  }
  if (payment === 'pending') {
    return { error: null };
  }
  return updateDeliveryOrderPayment(orderId, businessId, payment);
}
