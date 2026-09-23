'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { saveCommunity } from '@/services/community-actions';
import type { Community } from '@/types/community';

export function CommunityForm({ community }: { community?: Pick<Community, 'id' | 'name' | 'active'> }) {
  const router = useRouter();
  const [name, setName] = useState(community?.name ?? '');
  const [active, setActive] = useState(community?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await saveCommunity({ id: community?.id, name, active });
    setSubmitting(false);
    if (result.error || !result.id) {
      setError(result.error ?? 'Could not save the community.');
      return;
    }
    router.push(`/communities/${result.id}`);
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
      {community ? (
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
          Active
        </label>
      ) : null}
      {error ? <p className="text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="min-h-11 rounded-lg bg-emerald-800 px-4 py-2 font-semibold text-white disabled:opacity-60"
      >
        {submitting ? 'Saving…' : community ? 'Save community' : 'Create and manage customers'}
      </button>
    </form>
  );
}
