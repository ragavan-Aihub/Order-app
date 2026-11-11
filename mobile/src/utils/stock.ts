import { MAX_ITEM_QTY } from '@/cart/limits';
import { formatVolume, formatWeight, sellingTypeOf } from '@/utils/selling-units';

export const LOW_STOCK_SHOW = 5;

export function stockLimitOf(value: unknown): number | null {
  if (value == null || value === '') {
    return null;
  }
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }
  return Math.floor(amount);
}

export function lineStockUnits(item: {
  product: { selling_type?: string | null; stock_qty?: number | null };
  quantity: number;
  weightGrams?: number | null;
  volumeMl?: number | null;
  packWeightGrams?: number | null;
}): number {
  const qty = Math.max(0, Math.floor(item.quantity));
  const type = sellingTypeOf(item.product);
  if (type === 'kg') {
    return qty * Math.max(0, item.weightGrams ?? 0);
  }
  if (type === 'liter') {
    return qty * Math.max(0, item.volumeMl ?? 0);
  }
  return qty;
}

export function unitSizeOf(product: { selling_type?: string | null }, extras?: {
  weightGrams?: number | null;
  volumeMl?: number | null;
}): number {
  const type = sellingTypeOf(product);
  if (type === 'kg') {
    return Math.max(0, extras?.weightGrams ?? 0);
  }
  if (type === 'liter') {
    return Math.max(0, extras?.volumeMl ?? 0);
  }
  return 1;
}

export function stockMessage(left: number, sellingType?: string | null): string {
  if (left <= 0) {
    return 'This item is sold out.';
  }
  if (sellingType === 'kg') {
    return `Only ${formatWeight(left)} left.`;
  }
  if (sellingType === 'liter') {
    return `Only ${formatVolume(left)} left.`;
  }
  return left === 1 ? 'Only 1 left.' : `Only ${left} left.`;
}

export function stockLeftLabel(
  stockQty: unknown,
  sellingType?: string | null,
): string | null {
  const stock = stockLimitOf(stockQty);
  if (stock == null) {
    return null;
  }
  if (stock <= 0) {
    return 'Sold out';
  }
  if (sellingType === 'kg') {
    return `${formatWeight(stock)} left`;
  }
  if (sellingType === 'liter') {
    return `${formatVolume(stock)} left`;
  }
  if (stock > LOW_STOCK_SHOW) {
    return null;
  }
  return stock === 1 ? 'Only 1 left' : `Only ${stock} left`;
}

/** Max pieces for this line given remaining stock units (grams/ml/count). */
export function maxLineQty(
  stockQty: unknown,
  reservedUnits: number,
  otherLineUnits: number,
  unitSize: number,
): number {
  const stock = stockLimitOf(stockQty);
  if (stock == null) {
    return MAX_ITEM_QTY;
  }
  const remaining = stock + Math.max(0, reservedUnits) - Math.max(0, otherLineUnits);
  const size = Math.max(0, unitSize);
  if (size <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(MAX_ITEM_QTY, Math.floor(remaining / size)));
}
