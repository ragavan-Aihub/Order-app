'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { StatusBadge } from '@/components/OrderBadges';
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
  const [preset, setPreset] = useState<string>(CANCEL_REASON_PRESETS[0]);
  const [other, setOther] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(NEXT_STATUSES[status][0] ?? status);
    setError(null);
  }, [status]);

  const nextSelectOptions = useMemo(
    () => ORDER_STATUSES.filter((item) => nextOptions.includes(item.value)),
    [nextOptions],
  );

  async function onSave() {
    setError(null);
    const reason = value === 'cancelled' ? buildCancelReason(preset, other) : null;
    if (value === 'cancelled' && !reason) {
      setError('Add a short note for Other, or pick a reason.');
      return;
    }
    setSaving(true);
    const result = await updateOrderStatus(orderId, value, { cancelReason: reason });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Status</h2>
      <StatusBadge status={status} />
      {status === 'cancelled' && cancelReason ? (
        <p className="text-sm text-red-800">Reason: {cancelReason}</p>
      ) : null}

      {nextOptions.length === 0 ? (
        <p className="text-sm text-stone-500">No further status changes.</p>
      ) : (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-stone-600" htmlFor="order-status-next">
            Update to
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <select
              id="order-status-next"
              value={value}
              onChange={(event) => setValue(event.target.value as OrderStatus)}
              className="min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base sm:w-auto"
            >
              {nextSelectOptions.map((option) => (
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
              {saving ? 'Saving…' : 'Update'}
            </button>
          </div>
          {value === 'cancelled' ? (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-stone-600" htmlFor="cancel-reason">
                Cancellation reason
              </label>
              <select
                id="cancel-reason"
                value={preset}
                onChange={(event) => setPreset(event.target.value)}
                className="min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base"
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
                  onChange={(event) => setOther(event.target.value)}
                  placeholder="Short note for the customer"
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-base"
                  rows={2}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      )}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
