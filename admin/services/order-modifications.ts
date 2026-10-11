import {
  buildOrderModificationSummary,
  type OrderModificationSummary,
} from '@/lib/order-modification-state';
import { getAdminSession } from '@/services/supabase/admin-session';
import { createServerSupabaseClient } from '@/services/supabase/server';
import type { Order, OrderItem, OrderModificationItemSnapshot, OrderStatusEvent } from '@/types/order';

type ModRow = {
  order_id: string;
  actor_type: string;
  reason: string | null;
  previous_items: OrderModificationItemSnapshot[];
  new_items: OrderModificationItemSnapshot[];
  previous_total: number;
  new_total: number;
  created_at: string;
};

export async function loadOrderModificationSummaryForOrder(
  orderId: string,
  currentItems: OrderItem[],
  options?: {
    businessId?: string;
    status?: Order['status'];
    statusEvents?: OrderStatusEvent[];
  },
): Promise<OrderModificationSummary> {
  const mods = await loadModificationRowsForOrders([orderId], options?.businessId);
  return buildOrderModificationSummary(currentItems, mods.get(orderId) ?? [], {
    status: options?.status,
    statusEvents: options?.statusEvents,
  });
}

async function loadModificationRowsForOrders(
  orderIds: string[],
  businessIdHint?: string,
): Promise<Map<string, ModRow[]>> {
  if (orderIds.length === 0) {
    return new Map();
  }
  const session = await getAdminSession();
  const businessId =
    businessIdHint ?? ('error' in session ? undefined : session.profile.business_id);
  if (!businessId) {
    return new Map();
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return new Map();
  }
  const { data, error } = await supabase
    .from('order_modifications')
    .select('order_id, actor_type, reason, previous_items, new_items, previous_total, new_total, created_at')
    .eq('business_id', businessId)
    .in('order_id', orderIds)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[order_modifications]', error.message);
    return new Map();
  }
  return groupMods((data ?? []) as ModRow[]);
}

async function loadStatusEventsForOrders(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  orderIds: string[],
): Promise<Map<string, OrderStatusEvent[]>> {
  if (orderIds.length === 0) {
    return new Map();
  }
  const { data, error } = await supabase
    .from('order_status_events')
    .select('id, order_id, status, note, created_at')
    .in('order_id', orderIds)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[order_status_events]', error.message);
    return new Map();
  }
  const map = new Map<string, OrderStatusEvent[]>();
  for (const row of (data ?? []) as OrderStatusEvent[]) {
    const list = map.get(row.order_id) ?? [];
    list.push(row);
    map.set(row.order_id, list);
  }
  return map;
}

function groupMods(rows: ModRow[]): Map<string, ModRow[]> {
  const map = new Map<string, ModRow[]>();
  for (const row of rows) {
    const list = map.get(row.order_id) ?? [];
    list.push(row);
    map.set(row.order_id, list);
  }
  return map;
}

export async function annotateOrdersWithModificationFlags(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  orders: Order[],
  itemsByOrderId: Map<string, OrderItem[]>,
  businessId?: string,
): Promise<Order[]> {
  if (orders.length === 0) {
    return orders;
  }
  const ids = orders.map((order) => order.id);
  const [modsByOrder, eventsByOrder] = await Promise.all([
    loadModificationRowsForOrders(ids, businessId ?? orders[0]?.business_id),
    loadStatusEventsForOrders(supabase, ids),
  ]);

  return orders.map((order) => {
    const items = itemsByOrderId.get(order.id) ?? [];
    const summary = buildOrderModificationSummary(items, modsByOrder.get(order.id) ?? [], {
      status: order.status,
      statusEvents: eventsByOrder.get(order.id) ?? [],
    });
    return {
      ...order,
      admin_modified_from_placed: summary.modifiedFromPlaced,
      customer_modified_after_confirm: summary.customerModifiedAfterConfirm,
    };
  });
}

async function loadItemsByOrderId(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  orderIds: string[],
): Promise<Map<string, OrderItem[]>> {
  const map = new Map<string, OrderItem[]>();
  if (orderIds.length === 0) {
    return map;
  }
  const { data: lineItems } = await supabase
    .from('order_items')
    .select('order_id, product_id, product_name, product_price, quantity, subtotal')
    .in('order_id', orderIds);

  for (const row of lineItems ?? []) {
    const list = map.get(row.order_id as string) ?? [];
    list.push(row as OrderItem);
    map.set(row.order_id as string, list);
  }
  return map;
}

export async function countCustomerModifiedAfterConfirmOrders(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  businessId: string,
): Promise<number> {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, order_number, business_id, status, total_amount, created_at, updated_at')
    .eq('business_id', businessId)
    .in('status', ['confirmed', 'out_for_delivery']);
  if (error || !orders?.length) {
    return 0;
  }
  const typed = orders as Order[];
  const itemsByOrder = await loadItemsByOrderId(
    supabase,
    typed.map((order) => order.id),
  );
  const annotated = await annotateOrdersWithModificationFlags(supabase, typed, itemsByOrder, businessId);
  return annotated.filter((order) => order.customer_modified_after_confirm).length;
}

export async function annotateOrderRowsWithModificationFlags(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  orders: Order[],
  businessId: string,
): Promise<Order[]> {
  if (orders.length === 0) {
    return orders;
  }
  const itemsByOrder = await loadItemsByOrderId(
    supabase,
    orders.map((order) => order.id),
  );
  return annotateOrdersWithModificationFlags(supabase, orders, itemsByOrder, businessId);
}
