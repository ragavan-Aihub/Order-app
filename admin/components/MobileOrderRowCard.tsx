import Link from 'next/link';
import type { ReactNode } from 'react';

import { PaymentStatusBadge, StatusBadge } from '@/components/OrderBadges';
import type { OrderStatus, PaymentMethod, RefundStatus } from '@/types/order';
import { formatDateTime, formatOrderNumber, formatPrice } from '@/utils/format';

type Props = {
  orderId: string;
  orderNumber: number;
  customerName: string;
  totalAmount: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod | null;
  refundStatus?: RefundStatus | null;
  /** e.g. "Placed" or "Delivered" */
  timeLabel?: string;
  timeValue?: string;
  subtitle?: string;
  badges?: ReactNode;
};

export function MobileOrderRowCard({
  orderId,
  orderNumber,
  customerName,
  totalAmount,
  status,
  paymentMethod,
  refundStatus,
  timeLabel,
  timeValue,
  subtitle,
  badges,
}: Props) {
  return (
    <Link
      href={`/orders/${orderId}`}
      className="block rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition-colors active:bg-stone-50"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-base font-semibold text-emerald-900">#{formatOrderNumber(orderNumber)}</p>
        <p className="text-base font-semibold tabular-nums text-stone-900">{formatPrice(totalAmount)}</p>
      </div>
      <p className="mt-1 text-sm font-medium text-stone-800">{customerName}</p>
      {subtitle ? <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p> : null}
      {badges ? <div className="mt-2 flex flex-wrap gap-1.5">{badges}</div> : null}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <StatusBadge status={status} />
        <PaymentStatusBadge status={status} paymentMethod={paymentMethod} refundStatus={refundStatus ?? null} />
        {timeLabel && timeValue ? (
          <span className="text-xs text-stone-500">
            {timeLabel} {formatDateTime(timeValue)}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
