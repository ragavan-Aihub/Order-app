import {
  displayPaymentStatus,
  orderStatusBadgeClass,
  orderStatusLabel,
  paymentStatusBadgeClass,
  paymentStatusLabel,
} from '@/types/order';

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-semibold ${orderStatusBadgeClass(status)}`}>
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
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-semibold ${paymentStatusBadgeClass(value)}`}>
      {paymentStatusLabel(order)}
    </span>
  );
}
