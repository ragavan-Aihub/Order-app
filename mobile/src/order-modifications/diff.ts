import type { OrderModification, OrderModificationItemSnapshot } from '@/types/order';

export type OrderItemChange =
  | { kind: 'added'; name: string; quantity: number }
  | { kind: 'removed'; name: string; quantity: number }
  | { kind: 'qty'; name: string; from: number; to: number };

function lineKey(line: OrderModificationItemSnapshot): string {
  return line.product_id ?? line.product_name;
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
