import {
  buildOrderDiffTableRowsFromSnapshots,
  orderDiffHasChanges,
} from '@/lib/order-modification-diff';
import type { OrderItem, OrderModificationItemSnapshot } from '@/types/order';

export function normalizeModificationItems(raw: unknown): OrderModificationItemSnapshot[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(
    (line): line is OrderModificationItemSnapshot =>
      Boolean(line && typeof line === 'object' && typeof (line as OrderModificationItemSnapshot).product_name === 'string'),
  );
}

export type OrderModificationSummary = {
  placedItems: OrderModificationItemSnapshot[];
  placedTotal: number;
  /** Snapshot after all shop edits (ignores later customer-only edits). */
  adminCompareItems: OrderModificationItemSnapshot[];
  adminCompareTotal: number | null;
  /** Lines to restore when reverting shop changes (before first admin edit). */
  revertTargetItems: OrderModificationItemSnapshot[];
  revertTargetTotal: number | null;
  hasAdminModification: boolean;
  /** True only when the shop changed the order vs as placed — not customer self-serve edits alone. */
  modifiedFromPlaced: boolean;
  canRevertToPlaced: boolean;
};

type ModInput = {
  actor_type: string;
  reason?: string | null;
  previous_items: OrderModificationItemSnapshot[] | unknown;
  new_items?: OrderModificationItemSnapshot[] | unknown;
  previous_total: number;
  new_total?: number;
  created_at: string;
};

function getAdminEndSnapshot(mods: ModInput[]): OrderModificationItemSnapshot[] | null {
  const adminMods = mods
    .filter((mod) => mod.actor_type === 'admin' && mod.reason !== 'reverted_to_placed')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  if (!adminMods.length) {
    return null;
  }
  const last = adminMods[adminMods.length - 1];
  return normalizeModificationItems(last.new_items);
}

function getPreAdminSnapshot(mods: ModInput[]): {
  items: OrderModificationItemSnapshot[];
  total: number;
} | null {
  const firstAdmin = mods
    .filter((mod) => mod.actor_type === 'admin')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
  if (!firstAdmin) {
    return null;
  }
  const items = normalizeModificationItems(firstAdmin.previous_items);
  if (!items.length) {
    return null;
  }
  return { items, total: Number(firstAdmin.previous_total) };
}

function latestAdminMod(mods: ModInput[]): ModInput | null {
  const adminMods = mods
    .filter((mod) => mod.actor_type === 'admin')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return adminMods[adminMods.length - 1] ?? null;
}

export function buildOrderModificationSummary(
  _currentItems: OrderItem[],
  mods: ModInput[],
): OrderModificationSummary {
  const sorted = [...mods].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const first = sorted[0];
  const placedItems = normalizeModificationItems(first?.previous_items);
  const placedTotal = first ? Number(first.previous_total) : 0;
  const hasAdminModification = sorted.some((row) => row.actor_type === 'admin');
  const adminCompareItems = getAdminEndSnapshot(sorted) ?? [];
  const adminCompareTotal =
    adminCompareItems.length > 0
      ? adminCompareItems.reduce((sum, line) => sum + Number(line.subtotal), 0)
      : null;
  const preAdmin = getPreAdminSnapshot(sorted);
  const revertTargetItems = preAdmin?.items ?? [];
  const revertTargetTotal = preAdmin?.total ?? null;

  const latestAdmin = latestAdminMod(sorted);
  let modifiedFromPlaced = false;
  if (
    placedItems.length > 0 &&
    adminCompareItems.length > 0 &&
    latestAdmin?.reason !== 'reverted_to_placed'
  ) {
    modifiedFromPlaced = orderDiffHasChanges(
      buildOrderDiffTableRowsFromSnapshots(placedItems, adminCompareItems),
    );
  }

  const canRevertToPlaced =
    modifiedFromPlaced && revertTargetItems.length > 0 && latestAdmin?.reason !== 'reverted_to_placed';

  return {
    placedItems,
    placedTotal,
    adminCompareItems,
    adminCompareTotal,
    revertTargetItems,
    revertTargetTotal,
    hasAdminModification,
    modifiedFromPlaced,
    canRevertToPlaced,
  };
}
