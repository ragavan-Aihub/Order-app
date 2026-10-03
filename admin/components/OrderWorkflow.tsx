'use client';

import { ArrowRight, Check, CheckCircle2, ExternalLink, Undo2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { ActionNotice, useActionNotice } from '@/components/ActionNotice';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { MoreMenu, menuItemClass } from '@/components/MoreMenu';
import { OrderStepper } from '@/components/OrderStepper';
import { updateOrderStatus } from '@/services/order-actions';
import { CANCEL_REASON_PRESETS, ORDER_STATUSES, orderStatusLabel, type OrderStatus } from '@/types/order';
import { canCancel, nextAction, normalizeStatus } from '@/types/order-workflow';

type Variant = 'panel' | 'card' | 'row';
type Dialog = 'advance' | 'cancel' | 'correct' | null;

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
  detailsHref,
  allowCorrection = false,
  variant = 'panel',
}: {
  orderId: string;
  orderNumber: string;
  status: OrderStatus | string;
  cancelReason?: string | null;
  detailsHref?: string;
  allowCorrection?: boolean;
  variant?: Variant;
}) {
  const router = useRouter();
  const notice = useActionNotice();
  const [pending, setPending] = useState<{ from: string; status: OrderStatus; reason: string | null } | null>(
    null,
  );
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<string>(CANCEL_REASON_PRESETS[0]);
  const [other, setOther] = useState('');
  const [correctTo, setCorrectTo] = useState<OrderStatus>('new');

  const live = pending && pending.from === status ? pending : null;
  const current = live ? live.status : normalizeStatus(status);
  const reason = live ? live.reason : cancelReason ?? null;
  const action = nextAction(current);
  const closeDialog = useCallback(() => setDialog(null), []);

  async function commit(
    target: OrderStatus,
    options: { mode?: 'normal' | 'correct'; cancelReason?: string | null },
    done: string,
  ) {
    setError(null);
    notice.clear();
    setPending({
      from: status,
      status: target,
      reason: target === 'cancelled' ? options.cancelReason ?? null : null,
    });
    setBusy(true);
    const result = await updateOrderStatus(orderId, target, options);
    setBusy(false);
    if (result.error) {
      setPending(null);
      setError(result.error);
      return;
    }
    notice.show(done);
    router.refresh();
  }

  function confirmAdvance() {
    if (!action) {
      return;
    }
    setDialog(null);
    void commit(action.target, { mode: 'normal' }, `Order ${orderNumber} is now ${orderStatusLabel(action.target)}`);
  }

  function confirmCancel() {
    const text = buildCancelReason(preset, other);
    if (!text) {
      return;
    }
    setDialog(null);
    void commit('cancelled', { mode: 'normal', cancelReason: text }, `Order ${orderNumber} cancelled`);
  }

  function confirmCorrection() {
    const text = correctTo === 'cancelled' ? buildCancelReason(preset, other) : null;
    if (correctTo === 'cancelled' && !text) {
      return;
    }
    setDialog(null);
    void commit(correctTo, { mode: 'correct', cancelReason: text }, `Status changed to ${orderStatusLabel(correctTo)}`);
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

  const cancellable = canCancel(current);
  const hasMenu = Boolean(detailsHref || cancellable || allowCorrection);

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
  const primary = action ? (
    <button
      type="button"
      onClick={() => setDialog('advance')}
      disabled={busy}
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 ${
        variant === 'row'
          ? 'min-h-9 whitespace-nowrap px-3 text-sm'
          : variant === 'card'
            ? 'min-h-11 flex-1 px-4 text-sm'
            : 'min-h-12 flex-1 px-5 text-base'
      }`}
    >
      {busy ? 'Saving…' : action.label}
      {busy ? null : <ActionIcon size={variant === 'row' ? 15 : 18} strokeWidth={2.5} aria-hidden />}
    </button>
  ) : current === 'delivered' ? (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold text-emerald-800 ${
        variant === 'row' ? 'text-sm' : 'min-h-11 flex-1 rounded-lg bg-emerald-50 px-4 text-sm'
      }`}
    >
      <CheckCircle2 size={variant === 'row' ? 15 : 18} aria-hidden /> Order completed
    </span>
  ) : variant === 'row' ? null : (
    <span className="flex-1" />
  );

  const feedback = (
    <>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <ActionNotice message={notice.message} />
    </>
  );

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
          onConfirm={confirmAdvance}
          onCancel={closeDialog}
        />
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
        <OrderStepper status={current} cancelReason={reason} size="sm" />
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Order status</h2>
        {menu}
      </div>
      <OrderStepper status={current} cancelReason={reason} />
      {primary && (action || current === 'delivered') ? <div className="flex">{primary}</div> : null}
      {feedback}
      {dialogs}
    </div>
  );
}
