'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { saveCategory } from '@/services/category-actions';
import type { ProductCategory } from '@/types/category';

export function CategoryForm({ category, onSaved }: { category?: Pick<ProductCategory, 'id' | 'name'>; onSaved?: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(category?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await saveCategory({ id: category?.id, name });
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (!category?.id) {
      setName('');
    }
    onSaved?.();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-4 rounded-xl border border-stone-200 bg-white p-5">
      <label className="block">
        <span className="mb-1 block text-sm text-stone-500">Category name</span>
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
        className="min-h-11 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {submitting ? 'Saving…' : category ? 'Save category' : 'Create category'}
      </button>
    </form>
  );
}
