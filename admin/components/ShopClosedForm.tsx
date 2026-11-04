'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Spinner, useActionNotice } from '@/components/ActionNotice';
import { ChoiceSwitch } from '@/components/ChoiceSwitch';
import { isSupabaseConfigured } from '@/config/env';
import { updateShopClosed } from '@/services/business-actions';
import type { Business } from '@/types/business';

const FALLBACK = 'The shop is closed and is not taking orders right now.';

export function ShopClosedForm({ business }: { business: Business }) {
  const router = useRouter();
  const notice = useActionNotice();
  const [closed, setClosed] = useState(business.shop_closed);
  const [message, setMessage] = useState(business.shop_closed_message ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const shown = message.trim() || FALLBACK;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!isSupabaseConfigured) {
      setError('Connect Supabase to save this.');
      return;
    }
    setSubmitting(true);
    const result = await updateShopClosed({
      businessId: business.id,
      shopClosed: closed,
      shopClosedMessage: message,
    });
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    notice.show(closed ? 'Shop is closed for new orders' : 'Shop is open for new orders');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-4">
        <ChoiceSwitch
          checked={closed}
          onCheckedChange={setClosed}
          tone="red"
          title={closed ? 'Shop is closed' : 'Shop is open'}
          description={
            closed
              ? 'New orders from the customer app are blocked. Orders already placed can still be changed.'
              : 'Customers can place new orders. Turn this on when the shop should stop taking orders.'
          }
        />

        <label className="block rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <span className="block text-base font-semibold">Message customers see</span>
          <span className="mt-1 block text-sm leading-6 text-stone-600">
            Shown on the home screen and the cart while the shop is closed.
          </span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={4}
            placeholder="Closed on 08/11 and 09/11 for Diwali. Please order before Saturday."
            className="mt-3 w-full rounded-xl border border-stone-300 px-4 py-3 text-base leading-6"
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
      </div>

      <aside className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-xs font-semibold tracking-wide text-stone-500">CUSTOMER APP</p>
        <p className="mt-1 text-sm text-stone-600">
          {closed ? 'This card is on the home screen and the cart.' : 'This card stays hidden while the shop is open.'}
        </p>
        <div className={`mt-4 rounded-xl p-4 ${closed ? 'bg-red-50' : 'bg-stone-50 opacity-60'}`}>
          <p className="text-base font-extrabold text-red-900">Shop closed</p>
          <p className="mt-1 text-sm leading-6 text-red-900">{shown}</p>
        </div>
      </aside>
    </form>
  );
}
