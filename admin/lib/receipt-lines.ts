import { formatLineMultiplier } from '@/lib/selling-units';
import type { OrderItem, OrderModificationItemSnapshot } from '@/types/order';

export type ReceiptLine = {
  productName: string;
  orderQty: number;
  recdQty: number;
  rate: number;
  amount: number;
};

function lineKey(line: { product_id?: string | null; product_name: string }): string {
  return line.product_id ?? line.product_name.trim().toLowerCase();
}

/** Merge original order qty with billed (received) invoice lines for print receipts. */
export function buildReceiptLines(
  billedItems: Array<
    Pick<OrderItem, 'product_id' | 'product_name' | 'product_price' | 'quantity' | 'subtotal'>
  >,
  orderedItems: Array<
    Pick<OrderModificationItemSnapshot, 'product_id' | 'product_name' | 'product_price' | 'quantity' | 'subtotal'>
  > = [],
): ReceiptLine[] {
  const ordered = new Map<string, { name: string; qty: number; amount: number; rate: number }>();
  for (const line of orderedItems) {
    const key = lineKey(line);
    const prev = ordered.get(key);
    const qty = Number(line.quantity) || 0;
    const amount = Number(line.subtotal) || 0;
    const rate =
      Number(line.product_price) ||
      (qty > 0 ? amount / qty : 0);
    if (prev) {
      ordered.set(key, {
        name: prev.name,
        qty: prev.qty + qty,
        amount: prev.amount + amount,
        rate: prev.rate,
      });
    } else {
      ordered.set(key, {
        name: line.product_name,
        qty,
        amount,
        rate,
      });
    }
  }

  const billed = new Map<string, { name: string; qty: number; amount: number; rate: number }>();
  for (const line of billedItems) {
    const key = lineKey(line);
    const prev = billed.get(key);
    const qty = Number(line.quantity) || 0;
    const amount = Number(line.subtotal) || 0;
    const rate =
      Number(line.product_price) ||
      (qty > 0 ? amount / qty : 0);
    if (prev) {
      billed.set(key, {
        name: prev.name,
        qty: prev.qty + qty,
        amount: prev.amount + amount,
        rate: prev.rate,
      });
    } else {
      billed.set(key, {
        name: line.product_name,
        qty,
        amount,
        rate,
      });
    }
  }

  const source = ordered.size > 0 ? ordered : billed;
  const keys = [...new Set([...source.keys(), ...billed.keys()])];

  return keys.map((key) => {
    const before = ordered.get(key);
    const after = billed.get(key);
    const orderQty = before?.qty ?? (ordered.size > 0 ? 0 : after?.qty ?? 0);
    const recdQty = after?.qty ?? 0;
    const rate = after?.rate ?? before?.rate ?? 0;
    const amount = after?.amount ?? 0;
    return {
      productName: after?.name ?? before?.name ?? 'Item',
      orderQty,
      recdQty,
      rate,
      amount,
    };
  });
}

export function formatReceiptQty(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }
  return formatLineMultiplier(value);
}
