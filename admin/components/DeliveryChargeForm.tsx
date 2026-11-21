'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Spinner, useActionNotice } from '@/components/ActionNotice';
import { isSupabaseConfigured } from '@/config/env';
import { deliveryChargeOf, freeDeliveryMinOf } from '@/lib/delivery-charge';
import { updateDeliveryChargeSettings } from '@/services/business-actions';
import type { Business } from '@/types/business';
import { formatPrice } from '@/utils/format';

export function DeliveryChargeForm({ business }: { business: Business }) {
  const router = useRouter();
  const notice = useActionNotice();
  const initialCharge = deliveryChargeOf(business.delivery_charge);
  const initialFreeFrom = freeDeliveryMinOf(business.free_delivery_min_order);
  const [charge, setCharge] = useState(initialCharge > 0 ? String(initialCharge) : '');
  const [freeFrom, setFreeFrom] = useState(initialFreeFrom > 0 ? String(initialFreeFrom) : '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const parsedCharge = charge.trim() === '' ? 0 : Number(charge);
  const parsedFreeFrom = freeFrom.trim() === '' ? 0 : Number(freeFrom);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!isSupabaseConfigured) {
      setError('Connect Supabase to save this.');
      return;
    }
    if (charge.trim() !== '' && (!Number.isFinite(parsedCharge) || parsedCharge < 0)) {
      setError('Enter a valid delivery charge, or leave blank for none.');
      return;
    }
    if (freeFrom.trim() !== '' && (!Number.isFinite(parsedFreeFrom) || parsedFreeFrom < 0)) {
      setError('Enter a valid free-delivery threshold, or leave blank to turn it off.');
      return;
    }
    setSubmitting(true);
    const result = await updateDeliveryChargeSettings({
      businessId: business.id,
      deliveryCharge: parsedCharge,
      freeDeliveryMinOrder: parsedFreeFrom,
    });
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    notice.show('Delivery charge settings saved.');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-4">
      <label className="block rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <span className="block text-base font-semibold">Delivery charge (₹)</span>
        <span className="mt-1 block text-sm leading-6 text-stone-600">
          Added to the customer bill when free delivery does not apply. Applies to app orders and phone orders
          you create in admin. Leave empty or 0 for no charge.
        </span>
        <input
          type="number"
          min="0"
          step="1"
          inputMode="decimal"
          value={charge}
          onChange={(event) => setCharge(event.target.value)}
          placeholder="e.g. 30"
          className="mt-3 min-h-12 w-full max-w-xs rounded-xl border border-stone-300 px-4 py-3 text-base"
        />
      </label>

      <label className="block rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <span className="block text-base font-semibold">Free delivery from item total (₹)</span>
        <span className="mt-1 block text-sm leading-6 text-stone-600">
          When item total is at or above this amount, delivery is free (inclusive). The cart shows how much
          more to add. Example: charge {formatPrice(30)} and free from {formatPrice(500)}.
        </span>
        <input
          type="number"
          min="0"
          step="1"
          inputMode="decimal"
          value={freeFrom}
          onChange={(event) => setFreeFrom(event.target.value)}
          placeholder="e.g. 500"
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
        {submitting ? 'Saving…' : 'Save delivery settings'}
      </button>
    </form>
  );
}