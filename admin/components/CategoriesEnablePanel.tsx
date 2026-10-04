'use client';

import { useState } from 'react';

import { Spinner, useActionComplete } from '@/components/ActionNotice';
import { setCategoriesEnabled } from '@/services/category-actions';

export function CategoriesEnablePanel({ enabled }: { enabled: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { complete, refreshing } = useActionComplete();
  const working = busy || refreshing;

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
    complete(next ? 'Categories turned on' : 'Categories turned off');
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
          disabled={working}
          aria-busy={working}
          onClick={() => void setEnabled(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {working ? <Spinner /> : null}
          {working ? 'Enabling…' : 'Enable Categories'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {error ? <p className="w-full text-sm text-red-700">{error}</p> : null}
      <button
        type="button"
        disabled={working}
        aria-busy={working}
        onClick={() => void setEnabled(false)}
        className="text-sm font-medium text-stone-600 underline-offset-2 hover:underline disabled:opacity-60"
      >
        {working ? 'Turning off…' : 'Turn off Categories'}
      </button>
    </div>
  );
}
