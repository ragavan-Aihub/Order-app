'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { setCategoriesEnabled } from '@/services/category-actions';

export function CategoriesEnablePanel({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function setEnabled(next: boolean) {
    if (!next && !window.confirm('Turn off Categories? Product category fields will hide until you enable again.')) {
      return;
    }
    setError(null);
    setBusy(true);
    const result = await setCategoriesEnabled(next);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (!enabled) {
    return (
      <div className="max-w-xl space-y-4 rounded-xl border border-stone-200 bg-white p-5">
        <p className="text-stone-700">
          Categories are optional. Enable them to group products in admin. Items can stay uncategorized.
        </p>
        {error ? <p className="text-red-700">{error}</p> : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void setEnabled(true)}
          className="min-h-11 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {busy ? 'Enabling…' : 'Enable Categories'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {error ? <p className="w-full text-sm text-red-700">{error}</p> : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void setEnabled(false)}
        className="text-sm font-medium text-stone-600 underline-offset-2 hover:underline disabled:opacity-60"
      >
        {busy ? 'Turning off…' : 'Turn off Categories'}
      </button>
    </div>
  );
}
