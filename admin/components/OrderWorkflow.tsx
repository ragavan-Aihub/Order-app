'use client';

import { ArrowRight, Check, CheckCircle2, ExternalLink, RefreshCw, Undo2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { Spinner, useActionComplete } from '@/components/ActionNotice';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { MoreMenu, menuItemClass } from '@/components/MoreMenu';
import { OrderStepper } from '@/components/OrderStepper';
import { PaymentMethodPicker, type PaymentChoice } from '@/components/PaymentMethodPicker';
import { PrintReceiptButton } from '@/components/PrintReceiptButton';
import { updateOrderPayment, updateOrderRefund, updateOrderStatus } from '@/services/order-actions';
import {
  CANCEL_REASON_PRESETS,
  ORDER_STATUSES,
  displayPaymentStatus,
  isPaymentCollected,
  orderStatusLabel,
  paymentModeLabel,
  type OrderStatus,
  type OrderStatusEvent,
  type PaymentMethod,
  type RefundStatus,
} from '@/types/order';
import { canCancel, nextAction, normalizeStatus } from '@/types/order-workflow';
import { formatPrice } from '@/utils/format';

type Variant = 'panel' | 'card' | 'row';
type Dialog = 'advance' | 'cancel' | 'correct' | 'collect' | 'change' | 'refund' | null;

function buildCancelReason(preset: string, other: string) {
  if (preset === 'Other') {
    const note = other.trim();
    return note ? `Other: ${note}` : '';
  }
  return preset;
}

function CancelReasonPicker({
  preset,
  other,
  onPreset,
  onOther,
}: {
  preset: string;
  other: string;
  onPreset: (value: string) => void;
  onOther: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-stone-500">Reason</p>
      <div className="flex flex-wrap gap-2">
        {[...CANCEL_REASON_PRESETS, 'Other'].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onPreset(item)}
            aria-pressed={preset === item}
            className={`min-h-10 rounded-full px-3 text-sm font-medium ${
              preset === item
                ? 'bg-red-600 text-white'
                : 'bg-white text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50'
            }`}
          >
            {item}
          </button>
        ))}
      </div>
      {preset === 'Other' ? (
        <textarea
          value={other}
          onChange={(event) => onOther(event.target.value)}
          placeholder="Short note for the customer"
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          rows={2}
          autoFocus
        />
      ) : null}
    </div>
  );
}

export function OrderWorkflow({
  orderId,
  orderNumber,
  status,
  cancelReason,
  paymentMethod,
  detailsHref,
  allowCorrection = false,
  variant = 'panel',
  statusEvents,
  placedAt,
  invoicePrepared = false,
  amount,
  refundStatus = null,
  customerName,
  mobile,
  customerId,
  customerSourceLabel,
  deliveryAddress,
  pincode,
  deliveryNotes,
}: {
  orderId: string;
  orderNumber: string;
  status: OrderStatus | string;
  cancelReason?: string | null;
  paymentMethod?: string | null;
  detailsHref?: string;
  allowCorrection?: boolean;
  variant?: Variant;
  statusEvents?: OrderStatusEvent[];
  placedAt?: string | null;
  invoicePrepared?: boolean;
  amount?: number;
  refundStatus?: RefundStatus | null;
  customerName?: string | null;
  mobile?: string | null;
  customerId?: string | null;
  customerSourceLabel?: string | null;
  deliveryAddress?: string | null;
  pincode?: string | null;
  deliveryNotes?: string | null;
}) {
  const router = useRouter();
  const { complete, refreshing } = useActionComplete();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<string>(CANCEL_REASON_PRESETS[0]);
  const [other, setOther] = useState('');
  const [correctTo, setCorrectTo] = useState<OrderStatus>('new');
  const [payChoice, setPayChoice] = useState<PaymentChoice | null>(null);

  const current = normalizeStatus(status);
  const reason = cancelReason ?? null;
  const action = nextAction(current);
  const method = (paymentMethod ?? 'pending') as PaymentMethod;
  const askPayment = action?.target === 'delivered' && paymentMethod !== undefined && !isPaymentCollected(paymentMethod);
  const payState =
    typeof amount === 'number'
      ? displayPaymentStatus({ status: current, payment_method: method, refund_status: refundStatus })
      : null;
  const price = typeof amount === 'number' ? formatPrice(amount) : null;
  const methodLabel = paymentModeLabel(method);
  const showCustomerBlock = Boolean(customerName || deliveryAddress);
  const closeDialog = useCallback(() => setDialog(null), []);

  async function commitStatus(
    target: OrderStatus,
    options: { mode?: 'normal' | 'correct'; cancelReason?: string | null },
    done: string,
    collect?: 'cash' | 'upi',
  ) {
    setError(null);
    setBusy(true);
    const result = await updateOrderStatus(orderId, target, options);
    if (result.error) {
      setBusy(false);
      setError(result.error);
      return;
    }
    if (collect) {
      const paid = await updateOrderPayment(orderId, collect);
      if (paid.error) {
        setBusy(false);
        setError(`Order saved, but the payment was not recorded: ${paid.error} Use Collect payment.`);
        router.refresh();
        return;
      }
    }
    setBusy(false);
    complete(done);
  }

  async function commitPayment(next: { method: PaymentMethod; refund: RefundStatus | null }, done: string) {
    setError(null);
    setBusy(true);
    const result =
      next.refund === 'refunded' ? await updateOrderRefund(orderId) : await updateOrderPayment(orderId, next.method);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    complete(done);
  }

  function openAdvance() {
    setPayChoice(null);
    setDialog('advance');
  }

  function confirmAdvance() {
    if (!action || (askPayment && !payChoice)) {
      return;
    }
    const collect = askPayment && payChoice !== 'later' ? (payChoice as 'cash' | 'upi') : undefined;
    const base = `Order ${orderNumber} is now ${orderStatusLabel(action.target)}`;
    const done = collect
      ? `${base} · paid by ${paymentModeLabel(collect)}`
      : askPayment
        ? `${base} · payment outstanding`
        : base;
    setDialog(null);
    void commitStatus(action.target, { mode: 'normal' }, done, collect);
  }

  function confirmCancel() {
    const text = buildCancelReason(preset, other);
    if (!text) {
      return;
    }
    setDialog(null);
    void commitStatus('cancelled', { mode: 'normal', cancelReason: text }, `Order ${orderNumber} cancelled`);
  }

  function confirmCorrection() {
    const text = correctTo === 'cancelled' ? buildCancelReason(preset, other) : null;
    if (correctTo === 'cancelled' && !text) {
      return;
    }
    setDialog(null);
    void commitStatus(correctTo, { mode: 'correct', cancelReason: text }, `Status changed to ${orderStatusLabel(correctTo)}`);
  }

  function openCancel() {
    setPreset(CANCEL_REASON_PRESETS[0]);
    setOther('');
    setDialog('cancel');
  }

  function openCorrection() {
    setCorrectTo(ORDER_STATUSES.find((item) => item.value !== current)?.value ?? 'new');
    setPreset(CANCEL_REASON_PRESETS[0]);
    setOther('');
    setDialog('correct');
  }

  function openCollect() {
    setPayChoice(null);
    setDialog('collect');
  }

  function openChange() {
    setPayChoice(method === 'upi' ? 'cash' : 'upi');
    setDialog('change');
  }

  function confirmMethod() {
    if (!payChoice || !price) {
      return;
    }
    const changing = dialog === 'change';
    setDialog(null);
    if (payChoice === 'later') {
      void commitPayment({ method: 'pending', refund: null }, `${price} marked as not yet paid`);
      return;
    }
    void commitPayment(
      { method: payChoice, refund: null },
      changing
        ? `Payment method changed to ${paymentModeLabel(payChoice)}`
        : `${price} marked paid by ${paymentModeLabel(payChoice)}`,
    );
  }

  function confirmRefund() {
    if (!price) {
      return;
    }
    setDialog(null);
    void commitPayment({ method, refund: 'refunded' }, `Refund of ${price} recorded`);
  }

  const cancellable = canCancel(current);
  const canChangePayment = payState === 'paid';
  const canMarkRefunded = payState === 'refund_pending';
  const canPrintReceipt = invoicePrepared && current !== 'cancelled';
  const hasMenu = Boolean(detailsHref || cancellable || allowCorrection || canChangePayment || canMarkRefunded);

  const menu = hasMenu ? (
    <MoreMenu label={`More actions for order ${orderNumber}`}>
      {(close) => (
        <>
          {detailsHref ? (
            <Link href={detailsHref} role="menuitem" className={menuItemClass} onClick={close}>
              <ExternalLink size={16} aria-hidden /> View order details
            </Link>
          ) : null}
          {allowCorrection ? (
            <button
              type="button"
              role="menuitem"
              className={menuItemClass}
              onClick={() => {
                close();
                openCorrection();
              }}
            >
              <Undo2 size={16} aria-hidden /> Fix a status mistake
            </button>
          ) : null}
          {canChangePayment ? (
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
          ) : null}
          {canMarkRefunded && price ? (
            <button
              type="button"
              role="menuitem"
              className={menuItemClass}
              onClick={() => {
                close();
                setDialog('refund');
              }}
            >
              <Undo2 size={16} aria-hidden /> Mark {price} refunded
            </button>
          ) : null}
          {cancellable ? (
            <button
              type="button"
              role="menuitem"
              className={`${menuItemClass} border-t border-stone-100 text-red-700 hover:bg-red-50`}
              onClick={() => {
                close();
                openCancel();
              }}
            >
              <XCircle size={16} aria-hidden /> Cancel order
            </button>
          ) : null}
        </>
      )}
    </MoreMenu>
  ) : null;

  const ActionIcon = action?.target === 'delivered' ? Check : ArrowRight;
  const working = busy || refreshing;
  const iconSize = variant === 'row' ? 15 : 18;
  const needsInvoice = action?.target === 'packed' && !invoicePrepared;
  const primary = action ? (
    <button
      type="button"
      onClick={openAdvance}
      disabled={working || needsInvoice}
      title={needsInvoice ? 'Save the invoice before marking this order packed.' : undefined}
      aria-busy={working}
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 ${
        variant === 'row'
          ? 'min-h-9 whitespace-nowrap px-3 text-sm'
          : variant === 'card'
            ? 'min-h-11 flex-1 px-4 text-sm'
            : 'min-h-12 flex-1 px-5 text-base'
      }`}
    >
      {working ? <Spinner size={iconSize} /> : null}
      {working ? 'Saving…' : action.label}
      {working ? null : <ActionIcon size={iconSize} strokeWidth={2.5} aria-hidden />}
    </button>
  ) : current === 'delivered' ? (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold text-emerald-800 ${
        variant === 'row' ? 'text-sm' : 'min-h-11 flex-1 rounded-lg bg-emerald-50 px-4 text-sm'
      }`}
    >
      <CheckCircle2 size={iconSize} aria-hidden /> Order completed
    </span>
  ) : variant === 'row' ? null : (
    <span className="flex-1" />
  );

  const collectButton =
    variant === 'panel' && price && (payState === 'pending' || payState === 'outstanding') ? (
      <button
        type="button"
        onClick={openCollect}
        disabled={working}
        aria-busy={working}
        className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg border border-emerald-600 bg-white px-5 text-base font-semibold text-emerald-800 shadow-sm hover:bg-emerald-50 disabled:opacity-60"
      >
        {working ? <Spinner size={18} /> : null}
        {working ? 'Saving…' : `Collect ${price}`}
      </button>
    ) : null;

  const paidLine =
    variant === 'panel' && price && payState === 'paid' ? (
      <p className="text-base font-semibold text-emerald-800">
        Paid {price} by {methodLabel}
      </p>
    ) : variant === 'panel' && price && payState === 'refunded' ? (
      <p className="text-base font-semibold text-violet-800">
        Refunded {price} (paid by {methodLabel})
      </p>
    ) : variant === 'panel' && price && payState === 'outstanding' ? (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
        Delivered but not paid yet. {price} is outstanding.
      </p>
    ) : null;

  const feedback = (
    <>
      {needsInvoice && variant !== 'row' ? (
        <p className="text-sm text-amber-900">
          Save the invoice first (Prepare invoice on this order). Use Modify invoice only if you need to change it later.
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </>
  );

  const customerColumn =
    variant === 'panel' && showCustomerBlock ? (
      <div className="space-y-3 border-t border-stone-200 pt-3 md:border-t-0 md:border-l md:pl-3 md:pt-0">
        {customerName ? (
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Customer</h3>
            <p className="mt-1 text-base font-medium text-stone-900">{customerName}</p>
            {mobile ? <p className="text-base text-stone-600">{mobile}</p> : null}
            {customerSourceLabel ? (
              <p className="mt-0.5 text-sm text-stone-500">Source {customerSourceLabel}</p>
            ) : null}
            {customerId ? (
              <Link href={`/customers/${customerId}`} className="mt-1 inline-block text-sm font-medium text-emerald-800">
                Customer history
              </Link>
            ) : null}
          </div>
        ) : null}
        {deliveryAddress || pincode ? (
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Delivery</h3>
            {deliveryAddress ? (
              <p className="mt-1 whitespace-pre-wrap text-base text-stone-800">{deliveryAddress}</p>
            ) : null}
            {pincode ? <p className="mt-0.5 text-base text-stone-600">Pincode {pincode}</p> : null}
            {deliveryNotes ? <p className="mt-1 text-sm text-stone-600">Notes: {deliveryNotes}</p> : null}
          </div>
        ) : null}
      </div>
    ) : null;

  const dialogs = (
    <>
      {dialog === 'advance' && action ? (
        <ConfirmDialog
          title={action.confirmTitle(orderNumber)}
          body={
            action.target === 'delivered'
              ? 'This completes the order. The customer will see it as delivered.'
              : 'The customer will see this update in the app.'
          }
          confirmLabel={action.confirmLabel}
          confirmDisabled={askPayment && !payChoice}
          onConfirm={confirmAdvance}
          onCancel={closeDialog}
        >
          {askPayment ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-stone-500">Payment collected?</p>
              <PaymentMethodPicker value={payChoice} onChange={setPayChoice} allowLater />
              {payChoice === 'later' ? (
                <p className="text-xs text-red-700">The order will show as Outstanding until payment is collected.</p>
              ) : null}
            </div>
          ) : null}
        </ConfirmDialog>
      ) : null}
      {dialog === 'cancel' ? (
        <ConfirmDialog
          title={`Cancel order ${orderNumber}?`}
          body="The customer will see this order as cancelled. This cannot be undone from the normal flow."
          confirmLabel="Cancel order"
          tone="danger"
          confirmDisabled={!buildCancelReason(preset, other)}
          onConfirm={confirmCancel}
          onCancel={closeDialog}
        >
          <CancelReasonPicker preset={preset} other={other} onPreset={setPreset} onOther={setOther} />
        </ConfirmDialog>
      ) : null}
      {dialog === 'correct' ? (
        <ConfirmDialog
          title="Fix a status mistake"
          body="Use this only if the status was changed by mistake. It is not the next step."
          confirmLabel="Save correction"
          confirmDisabled={correctTo === 'cancelled' && !buildCancelReason(preset, other)}
          onConfirm={confirmCorrection}
          onCancel={closeDialog}
        >
          <label className="block text-xs font-medium text-stone-500" htmlFor={`correct-${orderId}`}>
            Correct status
          </label>
          <select
            id={`correct-${orderId}`}
            value={correctTo}
            onChange={(event) => setCorrectTo(event.target.value as OrderStatus)}
            className="mt-1 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm"
          >
            {ORDER_STATUSES.filter((item) => item.value !== current).map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          {correctTo === 'cancelled' ? (
            <div className="mt-3">
              <CancelReasonPicker preset={preset} other={other} onPreset={setPreset} onOther={setOther} />
            </div>
          ) : null}
        </ConfirmDialog>
      ) : null}
      {(dialog === 'collect' || dialog === 'change') && price ? (
        <ConfirmDialog
          title={dialog === 'collect' ? `Collect ${price} for order ${orderNumber}?` : 'Change payment method'}
          body={
            dialog === 'collect'
              ? 'Choose how the customer paid.'
              : `Currently recorded as ${methodLabel}. Use this only if the payment was saved by mistake.`
          }
          confirmLabel={dialog === 'collect' ? 'Mark paid' : 'Save method'}
          confirmDisabled={!payChoice || (dialog === 'change' && payChoice === method)}
          onConfirm={confirmMethod}
          onCancel={closeDialog}
        >
          <PaymentMethodPicker value={payChoice} onChange={setPayChoice} allowLater={dialog === 'change'} />
        </ConfirmDialog>
      ) : null}
      {dialog === 'refund' && price ? (
        <ConfirmDialog
          title={`Refund ${price} for order ${orderNumber}?`}
          body={`The customer paid by ${methodLabel}. Only mark this after the money has been returned.`}
          confirmLabel="Mark refunded"
          onConfirm={confirmRefund}
          onCancel={closeDialog}
        />
      ) : null}
    </>
  );

  if (variant === 'row') {
    return (
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-1">
          {primary}
          {menu}
        </div>
        {feedback}
        {dialogs}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className="space-y-3">
        <OrderStepper status={current} cancelReason={reason} size="sm" events={statusEvents} placedAt={placedAt} />
        <div className="flex items-center gap-2">
          {primary}
          {menu}
        </div>
        {feedback}
        {dialogs}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-10 items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Order status</h2>
        {menu}
      </div>
      <div className={showCustomerBlock ? 'grid gap-3 md:grid-cols-2' : undefined}>
        <div className="flex flex-col gap-3">
          <OrderStepper
            status={current}
            cancelReason={reason}
            size="sm"
            events={statusEvents}
            placedAt={placedAt}
          />
          {paidLine}
          {primary || collectButton || canPrintReceipt ? (
            <div className="flex flex-wrap gap-2">
              {primary && (action || current === 'delivered') ? primary : null}
              {collectButton}
              <PrintReceiptButton orderId={orderId} canPrint={canPrintReceipt} />
            </div>
          ) : null}
          {feedback}
        </div>
        {customerColumn}
      </div>
      {dialogs}
    </div>
  );
}
