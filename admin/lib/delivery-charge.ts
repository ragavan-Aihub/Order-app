import { formatPrice } from '@/utils/format';

export type DeliveryShopSettings = {
  delivery_charge?: number | null;
  free_delivery_min_order?: number | null;
};

export function deliveryChargeOf(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    return 0;
  }
  return Math.round(amount * 100) / 100;
}

export function freeDeliveryMinOf(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }
  return Math.round(amount * 100) / 100;
}

export type DeliveryBreakdown = {
  itemsSubtotal: number;
  listedCharge: number;
  charged: number;
  freeQualified: boolean;
  billTotal: number;
};

export function computeDeliveryBreakdown(
  itemsSubtotal: number,
  shop: DeliveryShopSettings | null | undefined,
): DeliveryBreakdown {
  const items = Math.max(0, Math.round(itemsSubtotal * 100) / 100);
  const listed = deliveryChargeOf(shop?.delivery_charge);
  const freeFrom = freeDeliveryMinOf(shop?.free_delivery_min_order);
  const freeQualified = freeFrom > 0 && items + 1e-9 >= freeFrom;
  const charged = listed <= 0 ? 0 : freeQualified ? 0 : listed;
  const billTotal = Math.round((items + charged) * 100) / 100;
  return {
    itemsSubtotal: items,
    listedCharge: listed,
    charged,
    freeQualified,
    billTotal,
  };
}

export function billTotalForMinCheck(
  itemsSubtotal: number,
  shop: DeliveryShopSettings | null | undefined,
): number {
  return computeDeliveryBreakdown(itemsSubtotal, shop).billTotal;
}