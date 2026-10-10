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
  hasAdminModification: boolean;
  modifiedFromPlaced: boolean;
  canRevertToPlaced: boolean;
};

function snapshotFromItems(items: OrderItem[]): OrderModificationItemSnapshot[] {
  return items.map((item) => ({
    product_id: item.product_id,
    product_name: item.product_name,
    product_price: Number(item.product_price),
    quantity: item.quantity,
    subtotal: Number(item.subtotal),
  }));
}

function productKey(item: OrderModificationItemSnapshot | OrderItem): string {
  const id =
    'product_id' in item && item.product_id
      ? item.product_id
      : item.product_name.trim().toLowerCase();
  return id;
}

function quantityByProduct(
  items: OrderModificationItemSnapshot[] | OrderItem[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = productKey(item as OrderModificationItemSnapshot);
    map.set(key, (map.get(key) ?? 0) + item.quantity);
  }
  return map;
}

export function orderItemsMatchPlaced(
  current: OrderItem[],
  placed: OrderModificationItemSnapshot[],
): boolean {
  if (placed.length === 0) {
    return true;
  }
  const a = quantityByProduct(current);
  const b = quantityByProduct(placed);
  if (a.size !== b.size) {
    return false;
  }
  for (const [key, qty] of a) {
    if (b.get(key) !== qty) {
      return false;
    }
  }
  return true;
}

export function buildOrderModificationSummary(
  currentItems: OrderItem[],
  mods: Array<{
    actor_type: string;
    previous_items: OrderModificationItemSnapshot[] | unknown;
    previous_total: number;
    created_at: string;
  }>,
): OrderModificationSummary {
  const sorted = [...mods].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const first = sorted[0];
  const placedItems = normalizeModificationItems(first?.previous_items);
  const placedTotal = first ? Number(first.previous_total) : currentItems.reduce((s, i) => s + Number(i.subtotal), 0);
  const hasAdminModification = sorted.some((row) => row.actor_type === 'admin');
  const modifiedFromPlaced =
    placedItems.length > 0 ? !orderItemsMatchPlaced(currentItems, placedItems) : false;

  return {
    placedItems,
    placedTotal,
    hasAdminModification,
    modifiedFromPlaced,
    canRevertToPlaced: hasAdminModification && modifiedFromPlaced && placedItems.length > 0,
  };
}
