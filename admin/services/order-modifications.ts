import { buildOrderModificationSummary, type OrderModificationSummary } from '@/lib/order-modification-state';
import { getAdminSession } from '@/services/supabase/admin-session';
import { createServerSupabaseClient } from '@/services/supabase/server';
import type { OrderItem, OrderModificationItemSnapshot } from '@/types/order';

type ModRow = {
  order_id: string;
  actor_type: string;
  previous_items: OrderModificationItemSnapshot[];
  previous_total: number;
  created_at: string;
};

export async function loadOrderModificationSummaryForOrder(
  orderId: string,
  currentItems: OrderItem[],
  businessId?: string,
): Promise<OrderModificationSummary> {
  const mods = await loadModificationRowsForOrders([orderId], businessId);
  return buildOrderModificationSummary(currentItems, mods.get(orderId) ?? []);
}

async function loadModificationRowsForOrders(
  orderIds: string[],
  businessIdHint?: string,
): Promise<Map<string, ModRow[]>> {
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
    .select('order_id, actor_type, previous_items, previous_total, created_at')
    .eq('business_id', businessId)
    .in('order_id', orderIds)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[order_modifications]', error.message);
    return new Map();
  }
  return groupMods((data ?? []) as ModRow[]);
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

export async function loadAdminModifiedFromPlacedIds(
  orderIds: string[],
  itemsByOrderId: Map<string, OrderItem[]>,
  businessId?: string,
): Promise<Set<string>> {
  if (orderIds.length === 0) {
    return new Set();
  }
  const byOrder = await loadModificationRowsForOrders(orderIds, businessId);
  const highlighted = new Set<string>();
  for (const orderId of orderIds) {
    const items = itemsByOrderId.get(orderId) ?? [];
    const summary = buildOrderModificationSummary(items, byOrder.get(orderId) ?? []);
    if (summary.modifiedFromPlaced) {
      highlighted.add(orderId);
    }
  }
  return highlighted;
}
