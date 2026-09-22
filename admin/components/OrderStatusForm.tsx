'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { updateOrderStatus } from '@/services/order-actions';
import {
  CANCEL_REASON_PRESETS,
  NEXT_STATUSES,
  ORDER_STATUSES,
  type OrderStatus,
} from '@/types/order';

function buildCancelReason(preset: string, other: string) {
  if (preset === 'Other') {
    const note = other.trim();
    return note ? `Other: ${note}` : '';
  }
  return preset;
}

function CancelReasonFields({
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
      <label className="block text-xs font-medium text-stone-500" htmlFor="cancel-reason">
        Cancellation reason
      </label>
      <select
        id="cancel-reason"
        value={preset}
        onChange={(event) => onPreset(event.target.value)}
        className="min-h-10 w-full rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm"
      >
        {CANCEL_REASON_PRESETS.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
        <option value="Other">Other</option>
      </select>
      {preset === 'Other' ? (
        <textarea
          value={other}
          onChange={(event) => onOther(event.target.value)}
          placeholder="Short note for the customer"
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
          rows={2}
        />
      ) : null}
    </div>
  );
}

export function OrderStatusForm({
  orderId,
  status,
  cancelReason,
}: {
  orderId: string;
  status: OrderStatus;
  cancelReason?: string | null;
}) {
  const router = useRouter();
  const nextOptions = NEXT_STATUSES[status];
  const [value, setValue] = useState<OrderStatus>(nextOptions[0] ?? status);
  const [correctValue, setCorrectValue] = useState<OrderStatus>(
    ORDER_STATUSES.find((item) => item.value !== status)?.value ?? status,
  );
  const [correctOpen, setCorrectOpen] = useState(false);
  const [preset, setPreset] = useState<string>(CANCEL_REASON_PRESETS[0]);
  const [other, setOther] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [correcting, setCorrecting] = useState(false);

  useEffect(() => {
    setValue(NEXT_STATUSES[status][0] ?? status);
    setCorrectValue(ORDER_STATUSES.find((item) => item.value !== status)?.value ?? status);
    setCorrectOpen(false);
    setError(null);
  }, [status]);

  const nextSelectOptions = useMemo(
    () => ORDER_STATUSES.filter((item) => nextOptions.includes(item.value)),
    [nextOptions],
  );
  const correctSelectOptions = useMemo(
    () => ORDER_STATUSES.filter((item) => item.value !== status),
    [status],
  );

  async function save(next: OrderStatus, mode: 'normal' | 'correct') {
    setError(null);
    const reason = next === 'cancelled' ? buildCancelReason(preset, other) : null;
    if (next === 'cancelled' && !reason) {
      setError('Add a short note for Other, or pick a reason.');
      return;
    }
    if (mode === 'normal') {
      setSaving(true);
    } else {
      setCorrecting(true);
    }
    const result = await updateOrderStatus(orderId, next, { mode, cancelReason: reason });
    setSaving(false);
    setCorrecting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold">Order status</h2>
      {status === 'cancelled' && cancelReason ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">Reason: {cancelReason}</p>
      ) : null}

      {nextOptions.length === 0 ? (
        <p className="text-sm text-stone-500">
          {status === 'delivered'
            ? 'Delivered orders cannot be updated through the normal flow.'
            : 'Cancelled orders cannot be updated through the normal flow.'}
        </p>
      ) : (
        <div className="space-y-3">
          <label className="block text-xs font-medium text-stone-500" htmlFor="order-status-next">
            Next status
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              id="order-status-next"
              value={value}
              onChange={(event) => setValue(event.target.value as OrderStatus)}
              className="min-h-10 w-full rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm sm:w-auto"
            >
              {nextSelectOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => save(value, 'normal')}
              disabled={saving || correcting}
              className="min-h-10 w-full rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
            >
              {saving ? 'Saving…' : 'Update status'}
            </button>
          </div>
          {value === 'cancelled' ? (
            <CancelReasonFields preset={preset} other={other} onPreset={setPreset} onOther={setOther} />
          ) : null}
        </div>
      )}

      <div className="border-t border-stone-100 pt-3">
        {correctOpen ? (
          <div className="space-y-3">
            <p className="text-xs text-stone-500">Use this only to fix a status mistake. It is not the next step.</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={correctValue}
                onChange={(event) => setCorrectValue(event.target.value as OrderStatus)}
                className="min-h-10 w-full rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm sm:w-auto"
              >
                {correctSelectOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => save(correctValue, 'correct')}
                disabled={saving || correcting}
                className="min-h-10 w-full rounded-md border border-stone-400 px-4 text-sm font-semibold text-stone-800 disabled:opacity-50 sm:w-auto"
              >
                {correcting ? 'Saving…' : 'Save correction'}
              </button>
              <button
                type="button"
                onClick={() => setCorrectOpen(false)}
                className="min-h-10 px-2 text-sm font-medium text-stone-500"
              >
                Cancel
              </button>
            </div>
            {correctValue === 'cancelled' && value !== 'cancelled' ? (
              <CancelReasonFields preset={preset} other={other} onPreset={setPreset} onOther={setOther} />
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCorrectOpen(true)}
            className="text-sm font-medium text-stone-600 underline-offset-2 hover:underline"
          >
            Correct status
          </button>
        )}
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
