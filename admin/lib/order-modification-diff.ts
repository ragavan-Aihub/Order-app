import type { OrderItem, OrderModificationItemSnapshot } from '@/types/order';

export type OrderItemChange =
  | { kind: 'added'; name: string; quantity: number }
  | { kind: 'removed'; name: string; quantity: number }
  | { kind: 'qty'; name: string; from: number; to: number };

function lineKey(line: OrderModificationItemSnapshot): string {
  return line.product_id ?? line.product_name.trim().toLowerCase();
}

function qtyMap(items: OrderModificationItemSnapshot[]): Map<string, OrderModificationItemSnapshot> {
  const map = new Map<string, OrderModificationItemSnapshot>();
  for (const line of items) {
    map.set(lineKey(line), line);
  }
  return map;
}

export function snapshotsFromOrderItems(items: OrderItem[]): OrderModificationItemSnapshot[] {
  return items.map((item) => ({
    product_id: item.product_id,
    product_name: item.product_name,
    product_price: Number(item.product_price),
    quantity: item.quantity,
    subtotal: Number(item.subtotal),
  }));
}

export function diffItemSnapshots(
  before: OrderModificationItemSnapshot[],
  after: OrderModificationItemSnapshot[],
): OrderItemChange[] {
  const prev = qtyMap(before);
  const next = qtyMap(after);
  const changes: OrderItemChange[] = [];

  for (const [key, line] of next) {
    const old = prev.get(key);
    if (!old) {
      changes.push({ kind: 'added', name: line.product_name, quantity: line.quantity });
    } else if (old.quantity !== line.quantity) {
      changes.push({ kind: 'qty', name: line.product_name, from: old.quantity, to: line.quantity });
    }
  }

  for (const [key, line] of prev) {
    if (!next.has(key)) {
      changes.push({ kind: 'removed', name: line.product_name, quantity: line.quantity });
    }
  }

  return changes;
}

export type OrderDiffRowKind = 'unchanged' | 'added' | 'removed' | 'qty_changed';

export type OrderDiffTableRow = {
  rowKey: string;
  kind: OrderDiffRowKind;
  productName: string;
  quantity: number;
  placedQuantity: number | null;
  unitPrice: number;
  subtotal: number;
  placedSubtotal: number | null;
};

export function buildOrderDiffTableRowsFromSnapshots(
  placed: OrderModificationItemSnapshot[],
  compare: OrderModificationItemSnapshot[],
): OrderDiffTableRow[] {
  if (!placed.length) {
    return compare.map((line) => ({
      rowKey: lineKey(line),
      kind: 'unchanged' as const,
      productName: line.product_name,
      quantity: line.quantity,
      placedQuantity: null,
      unitPrice: line.product_price,
      subtotal: line.subtotal,
      placedSubtotal: null,
    }));
  }

  const placedMap = qtyMap(placed);
  const compareMap = qtyMap(compare);
  const keys = new Set([...placedMap.keys(), ...compareMap.keys()]);

  const sortedKeys = [...keys].sort((a, b) => {
    const nameA = placedMap.get(a)?.product_name ?? compareMap.get(a)?.product_name ?? '';
    const nameB = placedMap.get(b)?.product_name ?? compareMap.get(b)?.product_name ?? '';
    return nameA.localeCompare(nameB);
  });

  const rows: OrderDiffTableRow[] = [];
  for (const key of sortedKeys) {
    const before = placedMap.get(key);
    const after = compareMap.get(key);
    if (before && !after) {
      rows.push({
        rowKey: key,
        kind: 'removed',
        productName: before.product_name,
        quantity: before.quantity,
        placedQuantity: before.quantity,
        unitPrice: before.product_price,
        subtotal: before.subtotal,
        placedSubtotal: before.subtotal,
      });
      continue;
    }
    if (after && !before) {
      rows.push({
        rowKey: key,
        kind: 'added',
        productName: after.product_name,
        quantity: after.quantity,
        placedQuantity: null,
        unitPrice: after.product_price,
        subtotal: after.subtotal,
        placedSubtotal: null,
      });
      continue;
    }
    if (after && before) {
      const kind: OrderDiffRowKind =
        before.quantity === after.quantity ? 'unchanged' : 'qty_changed';
      rows.push({
        rowKey: key,
        kind,
        productName: after.product_name,
        quantity: after.quantity,
        placedQuantity: before.quantity,
        unitPrice: after.product_price,
        subtotal: after.subtotal,
        placedSubtotal: before.subtotal,
      });
    }
  }
  return rows;
}

export function buildOrderDiffTableRows(
  placed: OrderModificationItemSnapshot[],
  current: OrderItem[],
): OrderDiffTableRow[] {
  return buildOrderDiffTableRowsFromSnapshots(placed, snapshotsFromOrderItems(current));
}

export function orderDiffHasChanges(rows: OrderDiffTableRow[]): boolean {
  return rows.some((row) => row.kind !== 'unchanged');
}

export function changeLabel(change: OrderItemChange): string {
  if (change.kind === 'added') {
    return `Added · ${change.name} × ${change.quantity}`;
  }
  if (change.kind === 'removed') {
    return `Removed · ${change.name} × ${change.quantity}`;
  }
  const delta = change.to - change.from;
  const dir = delta > 0 ? `+${delta}` : String(delta);
  return `Qty · ${change.name} · ${change.from} → ${change.to} (${dir})`;
}
