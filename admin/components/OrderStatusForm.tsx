'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { createBrowserSupabaseClient } from '@/services/supabase/browser';
import { ORDER_STATUSES, type OrderStatus } from '@/types/order';

export function OrderStatusForm({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const router = useRouter();
  const [value, setValue] = useState<OrderStatus>(status);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSave() {
    setError(null);
    setSaving(true);
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setError('Supabase is not configured.');
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase.from('orders').update({ status: value }).eq('id', orderId);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-stone-600" htmlFor="order-status">
        Status
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <select
          id="order-status"
          value={value}
          onChange={(event) => setValue(event.target.value as OrderStatus)}
          className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-base"
        >
          {ORDER_STATUSES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || value === status}
          className="rounded-lg bg-emerald-800 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Update status'}
        </button>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
