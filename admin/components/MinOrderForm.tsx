'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Spinner, useActionNotice } from '@/components/ActionNotice';
import { isSupabaseConfigured } from '@/config/env';
import { minOrderAmountOf } from '@/lib/min-order';
import { updateMinOrderAmount } from '@/services/business-actions';
import type { Business } from '@/types/business';
import { formatPrice } from '@/utils/format';

export function MinOrderForm({ business }: { business: Business }) {
  const router = useRouter();
  const notice = useActionNotice();
  const initial = minOrderAmountOf(business.min_order_amount);
  const [amount, setAmount] = useState(initial > 0 ? String(initial) : '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const parsed = amount.trim() === '' ? 0 : Number(amount);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!isSupabaseConfigured) {
      setError('Connect Supabase to save this.');
      return;
    }
    if (amount.trim() !== '' && (!Number.isFinite(parsed) || parsed < 0)) {
      setError('Enter a valid amount, or leave blank for no minimum.');
      return;
    }
    setSubmitting(true);
    const result = await updateMinOrderAmount({
      businessId: business.id,
      minOrderAmount: parsed,
    });
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    notice.show(
      parsed > 0
        ? `Minimum order saved: ${formatPrice(minOrderAmountOf(parsed))}`
        : 'Minimum order turned off',
    );
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-4">
      <label className="block rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <span className="block text-base font-semibold">Minimum order amount (₹)</span>
        <span className="mt-1 block text-sm leading-6 text-stone-600">
          The customer app cannot place or update an order below this total. Phone orders in admin are
          not limited. Leave empty or 0 for no minimum.
        </span>
        <input
          type="number"
          min="0"
          step="1"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="e.g. 200"
          className="mt-3 min-h-12 w-full max-w-xs rounded-xl border border-stone-300 px-4 py-3 text-base"
        />
      </label>

      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 sm:w-auto"
      >
        {submitting ? <Spinner /> : null}
        {submitting ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
