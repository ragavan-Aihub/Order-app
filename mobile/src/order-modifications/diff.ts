import type { OrderModification, OrderModificationItemSnapshot } from '@/types/order';

export type OrderItemChange =
  | { kind: 'added'; name: string; quantity: number }
  | { kind: 'removed'; name: string; quantity: number }
  | { kind: 'qty'; name: string; from: number; to: number };

export function orderLineKey(line: OrderModificationItemSnapshot): string {
  return line.product_id ?? line.product_name.trim().toLowerCase();
}

function lineKey(line: OrderModificationItemSnapshot): string {
  return orderLineKey(line);
}

function qtyMap(items: OrderModificationItemSnapshot[]): Map<string, OrderModificationItemSnapshot> {
  const map = new Map<string, OrderModificationItemSnapshot>();
  for (const line of items) {
    map.set(lineKey(line), line);
  }
  return map;
}

export function diffOrderModification(mod: OrderModification): OrderItemChange[] {
  const before = qtyMap(mod.previous_items);
  const after = qtyMap(mod.new_items);
  const changes: OrderItemChange[] = [];

  for (const [key, line] of after) {
    const prev = before.get(key);
    if (!prev) {
      changes.push({ kind: 'added', name: line.product_name, quantity: line.quantity });
    } else if (prev.quantity !== line.quantity) {
      changes.push({ kind: 'qty', name: line.product_name, from: prev.quantity, to: line.quantity });
    }
  }

  for (const [key, line] of before) {
    if (!after.has(key)) {
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

export function buildOrderDiffTableRows(
  placed: OrderModificationItemSnapshot[],
  current: OrderModificationItemSnapshot[],
): OrderDiffTableRow[] {
  const placedMap = qtyMap(placed);
  const currentMap = qtyMap(current);
  const keys = new Set([...placedMap.keys(), ...currentMap.keys()]);
  const sortedKeys = [...keys].sort((a, b) => {
    const nameA = placedMap.get(a)?.product_name ?? currentMap.get(a)?.product_name ?? '';
    const nameB = placedMap.get(b)?.product_name ?? currentMap.get(b)?.product_name ?? '';
    return nameA.localeCompare(nameB);
  });

  const rows: OrderDiffTableRow[] = [];
  for (const key of sortedKeys) {
    const before = placedMap.get(key);
    const after = currentMap.get(key);
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
      rows.push({
        rowKey: key,
        kind: before.quantity === after.quantity ? 'unchanged' : 'qty_changed',
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

export function orderDiffHasChanges(rows: OrderDiffTableRow[]): boolean {
  return rows.some((row) => row.kind !== 'unchanged');
}
