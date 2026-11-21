import {
  computeDeliveryBreakdown,
  freeDeliveryNudgeMessage,
  type DeliveryShopSettings,
} from '@/lib/delivery-charge';
import { formatPrice } from '@/utils/format';

export function AdminOrderBillSummary({
  itemsSubtotal,
  itemCount,
  shop,
}: {
  itemsSubtotal: number;
  itemCount: number;
  shop: DeliveryShopSettings | null | undefined;
}) {
  const hasItems = itemCount > 0;
  const bill = computeDeliveryBreakdown(itemsSubtotal, shop);
  const showDelivery = hasItems && bill.listedCharge > 0;
  const billTotal = hasItems ? bill.billTotal : bill.itemsSubtotal;
  const deliveryNudge = hasItems ? freeDeliveryNudgeMessage(itemsSubtotal, shop) : null;

  return (
    <dl className="space-y-2 text-sm">
      <div className="flex items-center justify-between text-stone-600">
        <dt>Item total</dt>
        <dd className="tabular-nums font-medium text-stone-900">{formatPrice(bill.itemsSubtotal)}</dd>
      </div>
      {showDelivery ? (
        <div className="flex items-center justify-between text-stone-600">
          <dt>Delivery</dt>
          <dd className="tabular-nums">
            {bill.freeQualified ? (
              <span className="inline-flex items-center gap-2 font-medium">
                <span className="text-stone-400 line-through">{formatPrice(bill.listedCharge)}</span>
                <span className="font-semibold text-emerald-700">Free</span>
              </span>
            ) : (
              <span className="font-medium text-stone-900">{formatPrice(bill.charged)}</span>
            )}
          </dd>
        </div>
      ) : null}
      {deliveryNudge ? (
        <p className="text-xs text-stone-500">{deliveryNudge}</p>
      ) : null}
      <div className="flex items-baseline justify-between border-t border-stone-100 pt-3">
        <dt className="text-sm font-semibold text-stone-900">Total</dt>
        <dd className="text-2xl font-bold tracking-tight tabular-nums text-stone-900">{formatPrice(billTotal)}</dd>
      </div>
    </dl>
  );
}