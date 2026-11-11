import { formatPrice } from '@/utils/format';

export function minOrderAmountOf(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }
  return Math.round(amount * 100) / 100;
}

export function belowMinOrder(total: number, min: number): boolean {
  return min > 0 && total + 1e-9 < min;
}

export function minOrderMessage(min: number): string {
  return `Minimum order is ${formatPrice(min)}. Add more items to continue.`;
}
