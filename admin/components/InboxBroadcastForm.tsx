'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Spinner, useActionNotice } from '@/components/ActionNotice';
import { isSupabaseConfigured } from '@/config/env';
import { sendInboxBroadcast, type InboxBroadcastRow } from '@/services/inbox-actions';

function whenLabel(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function InboxBroadcastForm({ history }: { history: InboxBroadcastRow[] }) {
  const router = useRouter();
  const notice = useActionNotice();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<'updates' | 'offers'>('updates');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!isSupabaseConfigured) {
      setError('Connect Supabase to send this.');
      return;
    }
    setSubmitting(true);
    const result = await sendInboxBroadcast({ title, body, category });
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    const push =
      result.pushSent == null
        ? ` Inbox saved. Phone alert failed${result.pushDetail ? `: ${result.pushDetail}` : ''}.`
        : ` Phone alert sent to ${result.pushSent} device${result.pushSent === 1 ? '' : 's'}.`;
    notice.show(`Saved for ${result.recipients ?? 0} customers.${push}`);
    setTitle('');
    setBody('');
    router.refresh();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,28rem)_1fr]">
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <span className="block text-base font-semibold">Type</span>
          <span className="mt-1 block text-sm leading-6 text-stone-600">
            Offers show as promotions. Updates are important shop messages (not order status).
          </span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as 'updates' | 'offers')}
            className="mt-3 min-h-12 w-full rounded-xl border border-stone-300 px-4 py-3 text-base"
          >
            <option value="updates">Important update</option>
            <option value="offers">Offer</option>
          </select>
        </label>
        <label className="block rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <span className="block text-base font-semibold">Title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={80}
            required
            placeholder="Shop closed tomorrow"
            className="mt-3 min-h-12 w-full rounded-xl border border-stone-300 px-4 py-3 text-base"
          />
        </label>
        <label className="block rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <span className="block text-base font-semibold">Message</span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={280}
            required
            rows={4}
            placeholder="We will not deliver on Monday. Place orders by Sunday evening."
            className="mt-3 w-full rounded-xl border border-stone-300 px-4 py-3 text-base"
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
          {submitting ? 'Sending…' : 'Send to customers'}
        </button>
      </form>

      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-base font-semibold">Recent messages</h2>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-stone-600">No important messages yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {history.map((item) => (
              <li key={item.id} className="rounded-xl border border-stone-100 bg-stone-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                  {item.category === 'offers' ? 'Offer' : 'Update'} · {whenLabel(item.created_at)}
                </p>
                <p className="mt-1 font-semibold text-stone-900">{item.title}</p>
                <p className="mt-1 text-sm text-stone-600">{item.body}</p>
                <p className="mt-2 text-xs text-stone-500">
                  {item.recipient_count} in inbox
                  {item.push_sent != null ? ` · ${item.push_sent} push` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
