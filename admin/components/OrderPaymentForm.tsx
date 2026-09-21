'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { PaymentStatusBadge } from '@/components/OrderBadges';
import { updateOrderPayment, updateOrderRefund } from '@/services/order-actions';
import {
  COLLECTABLE_PAYMENT_METHODS,
  displayPaymentStatus,
  isPaymentCollected,
  paymentModeLabel,
  type OrderStatus,
  type PaymentMethod,
  type RefundStatus,
} from '@/types/order';

export function OrderPaymentForm({
  orderId,
  status,
  paymentMethod,
  refundStatus,
}: {
  orderId: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  refundStatus: RefundStatus | null;
}) {
  const router = useRouter();
  const collected = isPaymentCollected(paymentMethod);
  const paymentState = displayPaymentStatus({
    status,
    payment_method: paymentMethod,
    refund_status: refundStatus,
  });
  const canMarkPaid = status !== 'cancelled' && !collected;
  const canMarkRefunded = paymentState === 'refund_pending';
  const [value, setValue] = useState<Exclude<PaymentMethod, 'pending'>>(
    paymentMethod === 'upi' ? 'upi' : 'cash',
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refunding, setRefunding] = useState(false);

  useEffect(() => {
    setValue(paymentMethod === 'upi' ? 'upi' : 'cash');
  }, [paymentMethod]);

  async function onSave() {
    setError(null);
    setSaving(true);
    const result = await updateOrderPayment(orderId, value);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function onRefund() {
    setError(null);
    setRefunding(true);
    const result = await updateOrderRefund(orderId);
    setRefunding(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Payment</h2>
      <dl className="space-y-3 text-base">
        <div>
          <dt className="text-sm font-medium text-stone-600">Payment status</dt>
          <dd className="mt-1">
            <PaymentStatusBadge status={status} paymentMethod={paymentMethod} refundStatus={refundStatus} />
          </dd>
        </div>
        {collected ? (
          <div>
            <dt className="text-sm font-medium text-stone-600">Mode of payment</dt>
            <dd className="text-xl font-semibold">{paymentModeLabel(paymentMethod)}</dd>
          </div>
        ) : null}
      </dl>

      {canMarkPaid ? (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-stone-600" htmlFor="payment-mode">
            Mode of payment
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <select
              id="payment-mode"
              value={value}
              onChange={(event) => setValue(event.target.value as Exclude<PaymentMethod, 'pending'>)}
              className="min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base sm:w-auto"
            >
              {COLLECTABLE_PAYMENT_METHODS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="min-h-11 w-full rounded-lg bg-emerald-800 px-4 py-2 font-semibold text-white disabled:opacity-50 sm:w-auto"
            >
              {saving ? 'Saving…' : 'Mark paid'}
            </button>
          </div>
        </div>
      ) : null}

      {canMarkRefunded ? (
        <button
          type="button"
          onClick={onRefund}
          disabled={refunding}
          className="min-h-11 w-full rounded-lg bg-emerald-800 px-4 py-2 font-semibold text-white disabled:opacity-50 sm:w-auto"
        >
          {refunding ? 'Saving…' : 'Mark refunded'}
        </button>
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
