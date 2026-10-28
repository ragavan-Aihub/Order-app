import { logDeliveryAudit } from '@/services/admin-audit';
import { enrichDeliveryOrderItems } from '@/services/order-item-images';
import { notifyOrderStatusPush } from '@/services/order-status-push';
import { getSupabaseClient } from '@/services/supabase';
import { formatOrderNumber } from '@/utils/format';
import { istTodayBounds } from '@/utils/ist-dates';
import {
  classifyStatusTransition,
  isPaymentCollected,
  normalizeOrderStatus,
} from '@/services/order-status-flow';
import {
  type Order,
  type OrderStatus,
  type OrderWithItems,
  type PaymentMethod,
} from '@/types/order';

export type DeliveryMutationResult = {
  error: string | null;
  /** No write needed — order already matches or moved ahead (e.g. admin updated). */
  outcome?: 'ok' | 'already_applied' | 'updated_elsewhere';
  currentStatus?: OrderStatus;
  userMessage?: string;
};

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
): Promise<DeliveryMutationResult> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { error: 'Supabase is not configured.' };
  }

  const { data: current, error: fetchError } = await supabase
    .from('orders')
    .select('id, status, payment_method, refund_status, order_number')
    .eq('id', orderId)
    .eq('business_id', businessId)
    .maybeSingle();

  if (fetchError) {
    return { error: fetchError.message };
  }
  if (!current) {
    return { error: 'Could not find this order.' };
  }

  const currentStatus = normalizeOrderStatus(current.status as string);
  const conflict = classifyStatusTransition(currentStatus, status);
  if (conflict) {
    return {
      error: conflict.outcome === 'blocked' ? conflict.message : null,
      outcome: conflict.outcome,
      currentStatus,
      userMessage: conflict.message,
    };
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
  const label = formatOrderNumber(current.order_number ?? 0);
  const summary =
    status === 'cancelled'
      ? `[Delivery] Order #${label} cancelled (could not deliver)`
      : `[Delivery] Order #${label} → ${status.replace(/_/g, ' ')}`;
  await logDeliveryAudit(supabase, businessId, {
    action: 'delivery.status_update',
    entityType: 'order',
    entityId: orderId,
    summary,
    details: { from: currentStatus, to: status },
  });
  return { error: null, outcome: 'ok', currentStatus: status };
}

export async function updateDeliveryOrderPayment(
  orderId: string,
  businessId: string,
  paymentMethod: PaymentMethod,
): Promise<DeliveryMutationResult> {
  if (paymentMethod !== 'cash' && paymentMethod !== 'upi' && paymentMethod !== 'pending') {
    return { error: 'Choose Cash, UPI or Not yet.' };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { error: 'Supabase is not configured.' };
  }

  const { data: current, error: fetchError } = await supabase
    .from('orders')
    .select('id, status, payment_method, refund_status, order_number')
    .eq('id', orderId)
    .eq('business_id', businessId)
    .maybeSingle();

  if (fetchError) {
    return { error: fetchError.message };
  }
  if (!current) {
    return { error: 'Could not update this order.' };
  }

  const currentStatus = normalizeOrderStatus(current.status as string);
  if (currentStatus === 'cancelled') {
    return {
      error: null,
      outcome: 'updated_elsewhere',
      currentStatus,
      userMessage: 'This order was cancelled. Payment cannot be recorded here.',
    };
  }
  if (current.payment_method === paymentMethod) {
    return {
      error: null,
      outcome: 'already_applied',
      currentStatus,
      userMessage: 'Payment is already recorded for this order.',
    };
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

  if (current.payment_method !== paymentMethod) {
    await logDeliveryAudit(supabase, businessId, {
      action: 'delivery.payment_update',
      entityType: 'order',
      entityId: orderId,
      summary: `[Delivery] Order #${formatOrderNumber(current.order_number ?? 0)} payment → ${paymentMethod}`,
      details: { from: current.payment_method, to: paymentMethod },
    });
  }

  return { error: null, outcome: 'ok', currentStatus };
}

async function fetchOrderDeliverySnapshot(
  orderId: string,
  businessId: string,
): Promise<
  | { error: string }
  | { status: OrderStatus; payment_method: PaymentMethod; order_number: number }
> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { error: 'Supabase is not configured.' };
  }
  const { data, error } = await supabase
    .from('orders')
    .select('status, payment_method, order_number')
    .eq('id', orderId)
    .eq('business_id', businessId)
    .maybeSingle();
  if (error) {
    return { error: error.message };
  }
  if (!data) {
    return { error: 'Could not find this order.' };
  }
  return {
    status: normalizeOrderStatus(data.status as string),
    payment_method: data.payment_method as PaymentMethod,
    order_number: data.order_number ?? 0,
  };
}

/** Record cash/UPI after the order is already delivered (e.g. marked in admin). */
export async function recordDeliveryPaymentOnly(
  orderId: string,
  businessId: string,
  payment: 'cash' | 'upi' | 'pending',
): Promise<DeliveryMutationResult> {
  const snapshot = await fetchOrderDeliverySnapshot(orderId, businessId);
  if ('error' in snapshot) {
    return { error: snapshot.error };
  }
  if (snapshot.status !== 'delivered') {
    return {
      error: 'This order is not delivered yet. Use the delivery swipe on the order screen.',
    };
  }
  if (isPaymentCollected(snapshot.payment_method)) {
    return {
      error: null,
      outcome: 'already_applied',
      currentStatus: 'delivered',
      userMessage: 'Payment is already recorded for this delivered order.',
    };
  }
  if (payment === 'pending') {
    return {
      error: null,
      outcome: 'already_applied',
      currentStatus: 'delivered',
      userMessage:
        'This order is already marked delivered. Outstanding payment must be updated in admin if needed.',
    };
  }
  return updateDeliveryOrderPayment(orderId, businessId, payment);
}

export async function deliverOrderWithPayment(
  orderId: string,
  businessId: string,
  payment: 'cash' | 'upi' | 'pending',
): Promise<DeliveryMutationResult> {
  const snapshot = await fetchOrderDeliverySnapshot(orderId, businessId);
  if ('error' in snapshot) {
    return { error: snapshot.error };
  }

  if (snapshot.status === 'delivered') {
    if (isPaymentCollected(snapshot.payment_method)) {
      return {
        error: null,
        outcome: 'already_applied',
        currentStatus: 'delivered',
        userMessage:
          'This order was already marked delivered with payment recorded (for example in admin).',
      };
    }
    return recordDeliveryPaymentOnly(orderId, businessId, payment);
  }

  const statusResult = await updateDeliveryOrderStatus(orderId, businessId, 'delivered');
  if (statusResult.error) {
    return statusResult;
  }
  if (
    statusResult.outcome === 'updated_elsewhere' &&
    statusResult.currentStatus !== 'delivered'
  ) {
    return statusResult;
  }
  if (payment === 'pending') {
    return { error: null, outcome: 'ok', currentStatus: 'delivered' };
  }
  return updateDeliveryOrderPayment(orderId, businessId, payment);
}
