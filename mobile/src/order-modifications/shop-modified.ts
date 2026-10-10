import {
  buildOrderDiffTableRows,
  orderDiffHasChanges,
  orderLineKey,
} from '@/order-modifications/diff';
import type { OrderItem, OrderModification, OrderModificationItemSnapshot } from '@/types/order';

export type CustomerAdminOrderDiff = {
  placed: OrderModificationItemSnapshot[];
  /** Lines after all admin edits (ignores later customer-only edits). */
  adminCompare: OrderModificationItemSnapshot[];
  current: OrderModificationItemSnapshot[];
  placedTotal: number;
  currentTotal: number;
};

export function snapshotsFromOrderItems(items: OrderItem[]): OrderModificationItemSnapshot[] {
  return items.map((item) => ({
    product_id: item.product_id,
    product_name: item.product_name,
    product_price: Number(item.product_price),
    quantity: item.quantity,
    subtotal: Number(item.subtotal),
  }));
}

export function getPlacedSnapshot(mods: OrderModification[]): OrderModificationItemSnapshot[] {
  if (!mods.length) {
    return [];
  }
  const sorted = [...mods].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  return sorted[0]?.previous_items ?? [];
}

export function orderDiffersFromPlaced(
  currentItems: OrderItem[],
  placed: OrderModificationItemSnapshot[],
): boolean {
  if (!placed.length) {
    return false;
  }
  const current = snapshotsFromOrderItems(currentItems);
  const before = new Map(placed.map((line) => [orderLineKey(line), line.quantity]));
  const after = new Map(current.map((line) => [orderLineKey(line), line.quantity]));
  if (before.size !== after.size) {
    return true;
  }
  for (const [key, qty] of before) {
    if (after.get(key) !== qty) {
      return true;
    }
  }
  return false;
}

export function getAdminEndSnapshot(mods: OrderModification[]): OrderModificationItemSnapshot[] | null {
  const adminMods = mods
    .filter((mod) => mod.actor_type === 'admin' && mod.reason !== 'reverted_to_placed')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  if (!adminMods.length) {
    return null;
  }
  return adminMods[adminMods.length - 1].new_items;
}

/** True when the shop changed items vs as placed (latest admin action is not a revert). */
export function isOrderShopModified(mods: OrderModification[]): boolean {
  const placed = getPlacedSnapshot(mods);
  const adminCompare = getAdminEndSnapshot(mods);
  if (!placed.length || !adminCompare) {
    return false;
  }

  const adminMods = mods
    .filter((mod) => mod.actor_type === 'admin')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const latestAdmin = adminMods[adminMods.length - 1];
  if (!latestAdmin || latestAdmin.reason === 'reverted_to_placed') {
    return false;
  }

  return orderDiffHasChanges(buildOrderDiffTableRows(placed, adminCompare));
}

/** Show order-detail diff only when the shop (admin) changed the order — not customer self-serve edits alone. */
export function pickCustomerAdminOrderDiff(
  mods: OrderModification[],
  currentItems: OrderItem[],
): CustomerAdminOrderDiff | null {
  const placed = getPlacedSnapshot(mods);
  const adminCompare = getAdminEndSnapshot(mods);
  if (!placed.length || !adminCompare) {
    return null;
  }
  if (!orderDiffHasChanges(buildOrderDiffTableRows(placed, adminCompare))) {
    return null;
  }

  const current = snapshotsFromOrderItems(currentItems);
  const placedTotal = placed.reduce((sum, line) => sum + Number(line.subtotal), 0);
  const currentTotal = current.reduce((sum, line) => sum + Number(line.subtotal), 0);

  return {
    placed,
    adminCompare,
    current,
    placedTotal,
    currentTotal,
  };
}
