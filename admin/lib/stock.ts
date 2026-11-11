import { formatVolume, formatWeight, type SellingType } from '@/lib/selling-units';

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

export function parseStockInput(
  raw: string,
  sellingType: SellingType,
): { ok: true; value: number | null } | { ok: false } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }
  if (sellingType === 'kg' || sellingType === 'liter') {
    if (!/^\d+(\.\d{1,3})?$/.test(trimmed)) {
      return { ok: false };
    }
    const amount = Number(trimmed);
    if (!Number.isFinite(amount) || amount < 0 || amount > 10_000) {
      return { ok: false };
    }
    return { ok: true, value: Math.round(amount * 1000) };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false };
  }
  const amount = Number(trimmed);
  if (!Number.isInteger(amount) || amount < 0 || amount > 100_000) {
    return { ok: false };
  }
  return { ok: true, value: amount };
}

export function stockToInputValue(stockQty: unknown, sellingType: SellingType): string {
  const stock = stockLimitOf(stockQty);
  if (stock == null) {
    return '';
  }
  if (sellingType === 'kg' || sellingType === 'liter') {
    const major = stock / 1000;
    if (Number.isInteger(major)) {
      return String(major);
    }
    return String(major);
  }
  return String(stock);
}

export function lineStockUnits(
  sellingType: SellingType | string | null | undefined,
  quantity: number,
  weightGrams?: number | null,
  volumeMl?: number | null,
): number {
  const qty = Math.max(0, Math.floor(quantity));
  if (sellingType === 'kg') {
    return qty * Math.max(0, weightGrams ?? 0);
  }
  if (sellingType === 'liter') {
    return qty * Math.max(0, volumeMl ?? 0);
  }
  return qty;
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
  return stock === 1 ? '1 left' : `${stock} left`;
}
