'use client';

import { CheckCircle2, RefreshCw, Undo2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { ActionNotice, useActionNotice } from '@/components/ActionNotice';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { MoreMenu, menuItemClass } from '@/components/MoreMenu';
import { StepTrack } from '@/components/OrderStepper';
import { PaymentMethodPicker } from '@/components/PaymentMethodPicker';
import { updateOrderPayment, updateOrderRefund } from '@/services/order-actions';
import {
  displayPaymentStatus,
  paymentModeLabel,
  type OrderStatus,
  type PaymentMethod,
  type RefundStatus,
} from '@/types/order';
import { formatPrice } from '@/utils/format';

type Collectable = Exclude<PaymentMethod, 'pending'>;
type Dialog = 'collect' | 'change' | 'refund' | null;

export function OrderPaymentForm({
  orderId,
  orderNumber,
  amount,
  status,
  paymentMethod,
  refundStatus,
}: {
  orderId: string;
  orderNumber: string;
  amount: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  refundStatus: RefundStatus | null;
}) {
  const router = useRouter();
  const notice = useActionNotice();
  const source = `${status}|${paymentMethod}|${refundStatus ?? ''}`;
  const [pending, setPending] = useState<{ from: string; method: PaymentMethod; refund: RefundStatus | null } | null>(
    null,
  );
  const [dialog, setDialog] = useState<Dialog>(null);
  const [choice, setChoice] = useState<Collectable | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const live = pending && pending.from === source ? pending : null;
  const method = live ? live.method : paymentMethod;
  const refund = live ? live.refund : refundStatus;
  const state = displayPaymentStatus({ status, payment_method: method, refund_status: refund });
  const price = formatPrice(amount);
  const methodLabel = paymentModeLabel(method);
  const closeDialog = useCallback(() => setDialog(null), []);

  async function commit(next: { method: PaymentMethod; refund: RefundStatus | null }, done: string) {
    setError(null);
    notice.clear();
    setPending({ from: source, ...next });
    setBusy(true);
    const result =
      next.refund === 'refunded' ? await updateOrderRefund(orderId) : await updateOrderPayment(orderId, next.method);
    setBusy(false);
    if (result.error) {
      setPending(null);
      setError(result.error);
      return;
    }
    notice.show(done);
    router.refresh();
  }

  function openCollect() {
    setChoice(null);
    setDialog('collect');
  }

  function openChange() {
    setChoice(method === 'upi' ? 'cash' : 'upi');
    setDialog('change');
  }

  function confirmMethod() {
    if (!choice) {
      return;
    }
    const changing = dialog === 'change';
    setDialog(null);
    void commit(
      { method: choice, refund: null },
      changing ? `Payment method changed to ${paymentModeLabel(choice)}` : `${price} marked paid by ${paymentModeLabel(choice)}`,
    );
  }

  function confirmRefund() {
    setDialog(null);
    void commit({ method, refund: 'refunded' }, `Refund of ${price} recorded`);
  }

  const cancelled = status === 'cancelled';
  const track = cancelled
    ? state === 'not_applicable'
      ? null
      : { steps: ['Paid', 'Refund pending', 'Refunded'], current: state === 'refunded' ? 2 : 1, finished: state === 'refunded' }
    : {
        steps: [state === 'outstanding' ? 'Outstanding' : 'Awaiting payment', 'Paid'],
        current: state === 'paid' ? 1 : 0,
        finished: state === 'paid',
      };

  const menu =
    state === 'paid' ? (
      <MoreMenu label={`More payment actions for order ${orderNumber}`}>
        {(close) => (
          <button
            type="button"
            role="menuitem"
            className={menuItemClass}
            onClick={() => {
              close();
              openChange();
            }}
          >
            <RefreshCw size={16} aria-hidden /> Change payment method
          </button>
        )}
      </MoreMenu>
    ) : null;

  const done = (text: string) => (
    <span className="inline-flex min-h-11 flex-1 items-center gap-1.5 rounded-lg bg-emerald-50 px-4 text-sm font-semibold text-emerald-800">
      <CheckCircle2 size={18} aria-hidden /> {text}
    </span>
  );

  const primary =
    state === 'pending' || state === 'outstanding' ? (
      <button
        type="button"
        onClick={openCollect}
        disabled={busy}
        className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-base font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
      >
        {busy ? 'Saving…' : `Collect ${price}`}
      </button>
    ) : state === 'refund_pending' ? (
      <button
        type="button"
        onClick={() => setDialog('refund')}
        disabled={busy}
        className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 text-base font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
      >
        {busy ? (
          'Saving…'
        ) : (
          <>
            <Undo2 size={18} aria-hidden /> Mark {price} refunded
          </>
        )}
      </button>
    ) : state === 'paid' ? (
      done(`Paid ${price} by ${methodLabel}`)
    ) : state === 'refunded' ? (
      done(`Refunded ${price} (paid by ${methodLabel})`)
    ) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Payment</h2>
        <div className="flex items-center gap-1">
          <span className="text-base font-semibold text-stone-900">{price}</span>
          {menu}
        </div>
      </div>

      {track ? (
        <StepTrack steps={track.steps} current={track.current} finished={track.finished} label="Payment progress" />
      ) : (
        <p className="text-sm text-stone-400" aria-label="No payment">
          —
        </p>
      )}

      {state === 'outstanding' ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          Delivered but not paid yet. {price} is outstanding.
        </p>
      ) : null}
      {primary ? <div className="flex">{primary}</div> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <ActionNotice message={notice.message} />

      {dialog === 'collect' || dialog === 'change' ? (
        <ConfirmDialog
          title={dialog === 'collect' ? `Collect ${price} for order ${orderNumber}?` : 'Change payment method'}
          body={
            dialog === 'collect'
              ? 'Choose how the customer paid.'
              : `Currently recorded as ${methodLabel}. Use this only if the wrong method was saved.`
          }
          confirmLabel={dialog === 'collect' ? 'Mark paid' : 'Save method'}
          confirmDisabled={!choice || (dialog === 'change' && choice === method)}
          onConfirm={confirmMethod}
          onCancel={closeDialog}
        >
          <PaymentMethodPicker value={choice} onChange={setChoice} />
        </ConfirmDialog>
      ) : null}
      {dialog === 'refund' ? (
        <ConfirmDialog
          title={`Refund ${price} for order ${orderNumber}?`}
          body={`The customer paid by ${methodLabel}. Only mark this after the money has been returned.`}
          confirmLabel="Mark refunded"
          onConfirm={confirmRefund}
          onCancel={closeDialog}
        />
      ) : null}
    </div>
  );
}
