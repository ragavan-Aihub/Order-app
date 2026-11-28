import { formatOrderItemQty } from '@/utils/selling-units';

export type ReceiptLineSnapshot = {
  product_id?: string | null;
  product_name: string;
  product_price?: number | null;
  quantity: number;
  subtotal: number;
  selling_type?: string | null;
  selling_unit?: string | null;
  pack_weight_grams?: number | null;
  weight_grams?: number | null;
  volume_ml?: number | null;
};

export type ReceiptLine = {
  productName: string;
  orderQtyLabel: string;
  recdQtyLabel: string;
  rate: number;
  amount: number;
};

function lineKey(line: { product_id?: string | null; product_name: string }): string {
  return line.product_id ?? line.product_name.trim().toLowerCase();
}

function formatPlainQty(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  return (Math.round(value * 100) / 100)
    .toFixed(2)
    .replace(/0$/, '')
    .replace(/\.0$/, '');
}

/** Merge original order qty with billed (received) invoice lines for the delivery bill. */
export function buildReceiptLines(
  billedItems: ReceiptLineSnapshot[],
  orderedItems: ReceiptLineSnapshot[] = [],
): ReceiptLine[] {
  const ordered = new Map<string, { name: string; qty: number; amount: number; rate: number; sample?: ReceiptLineSnapshot }>();
  for (const line of orderedItems) {
    const key = lineKey(line);
    const prev = ordered.get(key);
    const qty = Number(line.quantity) || 0;
    const amount = Number(line.subtotal) || 0;
    const rate = Number(line.product_price) || (qty > 0 ? amount / qty : 0);
    if (prev) {
      ordered.set(key, {
        name: prev.name,
        qty: prev.qty + qty,
        amount: prev.amount + amount,
        rate: prev.rate,
        sample: prev.sample,
      });
    } else {
      ordered.set(key, { name: line.product_name, qty, amount, rate, sample: line });
    }
  }

  const billed = new Map<string, { name: string; qty: number; amount: number; rate: number; sample: ReceiptLineSnapshot }>();
  for (const line of billedItems) {
    const key = lineKey(line);
    const prev = billed.get(key);
    const qty = Number(line.quantity) || 0;
    const amount = Number(line.subtotal) || 0;
    const rate = Number(line.product_price) || (qty > 0 ? amount / qty : 0);
    if (prev) {
      billed.set(key, {
        name: prev.name,
        qty: prev.qty + qty,
        amount: prev.amount + amount,
        rate: prev.rate,
        sample: prev.sample,
      });
    } else {
      billed.set(key, { name: line.product_name, qty, amount, rate, sample: line });
    }
  }

  const source = ordered.size > 0 ? ordered : billed;
  const keys = [...new Set([...source.keys(), ...billed.keys()])];

  return keys.map((key) => {
    const before = ordered.get(key);
    const after = billed.get(key);
    const orderQty = before?.qty ?? (ordered.size > 0 ? 0 : after?.qty ?? 0);
    const recdQty = after?.qty ?? 0;
    const sample = after?.sample ?? before?.sample;
    const orderQtyLabel = sample
      ? formatOrderItemQty({ ...sample, quantity: orderQty })
      : formatPlainQty(orderQty);
    const recdQtyLabel = after?.sample
      ? formatOrderItemQty({ ...after.sample, quantity: recdQty })
      : formatPlainQty(recdQty);

    return {
      productName: after?.name ?? before?.name ?? 'Item',
      orderQtyLabel,
      recdQtyLabel,
      rate: after?.rate ?? before?.rate ?? 0,
      amount: after?.amount ?? 0,
    };
  });
}
