'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Spinner, useActionNotice } from '@/components/ActionNotice';
import { saveCommunity } from '@/services/community-actions';
import type { Community } from '@/types/community';

export function CommunityForm({ community }: { community?: Pick<Community, 'id' | 'name'> }) {
  const router = useRouter();
  const notice = useActionNotice();
  const [name, setName] = useState(community?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await saveCommunity({ id: community?.id, name });
    if (result.error || !result.id) {
      setSubmitting(false);
      setError(result.error ?? 'Could not save the community.');
      return;
    }
    notice.show(community ? 'Community saved' : `Community ${name.trim()} created`);
    router.push(`/customers/communities/${result.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-4 rounded-xl border border-stone-200 bg-white p-5">
      <label className="block">
        <span className="mb-1 block text-sm text-stone-500">Community name</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          minLength={2}
          className="min-h-11 w-full rounded-lg border border-stone-300 px-3 py-2"
        />
      </label>
      {error ? <p className="text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
      >
        {submitting ? <Spinner /> : null}
        {submitting ? 'Saving…' : community ? 'Save community' : 'Create and manage customers'}
      </button>
    </form>
  );
}
