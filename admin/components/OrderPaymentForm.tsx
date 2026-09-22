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
  const canCollect = status !== 'cancelled';
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
    <div className="space-y-3">
      <h2 className="text-base font-semibold">Payment</h2>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-stone-500">Payment status</dt>
          <dd className="mt-1">
            <PaymentStatusBadge status={status} paymentMethod={paymentMethod} refundStatus={refundStatus} />
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-stone-500">Payment method</dt>
          <dd className="mt-1 font-medium">{collected ? paymentModeLabel(paymentMethod) : '—'}</dd>
        </div>
      </dl>

      {paymentState === 'not_applicable' ? (
        <p className="text-sm text-stone-500">No payment was collected, so this stays Not Applicable.</p>
      ) : null}

      {canCollect ? (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-stone-500" htmlFor="payment-mode">
            {collected ? 'Update method' : 'Collect payment'}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              id="payment-mode"
              value={value}
              onChange={(event) => setValue(event.target.value as Exclude<PaymentMethod, 'pending'>)}
              className="min-h-10 w-full rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm sm:w-auto"
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
              disabled={saving || (collected && value === paymentMethod)}
              className={
                collected
                  ? 'min-h-10 w-full rounded-md border border-stone-400 px-4 text-sm font-semibold text-stone-800 disabled:opacity-50 sm:w-auto'
                  : 'min-h-10 w-full rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto'
              }
            >
              {saving ? 'Saving…' : collected ? 'Update payment' : 'Mark paid'}
            </button>
          </div>
        </div>
      ) : null}

      {canMarkRefunded ? (
        <button
          type="button"
          onClick={onRefund}
          disabled={refunding}
          className="min-h-10 rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {refunding ? 'Saving…' : 'Mark refunded'}
        </button>
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
