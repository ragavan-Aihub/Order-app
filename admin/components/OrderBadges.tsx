import {
  displayPaymentStatus,
  orderStatusBadgeClass,
  orderStatusLabel,
  paymentStatusBadgeClass,
  paymentStatusLabel,
} from '@/types/order';

export function StatusBadge({ status, size = 'sm' }: { status: string; size?: 'sm' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs';
  return (
    <span className={`inline-flex rounded-full font-semibold ${sizeClass} ${orderStatusBadgeClass(status)}`}>
      {orderStatusLabel(status)}
    </span>
  );
}

export function PaymentStatusBadge({
  status,
  paymentMethod,
  refundStatus,
}: {
  status: string;
  paymentMethod?: string | null;
  refundStatus?: string | null;
}) {
  const order = { status, payment_method: paymentMethod, refund_status: refundStatus };
  const value = displayPaymentStatus(order);
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${paymentStatusBadgeClass(value)}`}>
      {paymentStatusLabel(order)}
    </span>
  );
}
