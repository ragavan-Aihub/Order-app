'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ActionNotice, useActionNotice } from '@/components/ActionNotice';
import { setCommunitiesEnabled } from '@/services/community-actions';

export function CommunitiesEnablePanel({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const notice = useActionNotice();

  async function setEnabled(next: boolean) {
    if (!next && !window.confirm('Turn off Communities? Orders will hide Type and Community until you enable it again.')) {
      return;
    }
    setError(null);
    notice.clear();
    setBusy(true);
    const result = await setCommunitiesEnabled(next);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    notice.show('Saved successfully');
    router.refresh();
  }

  if (!enabled) {
    return (
      <div className="max-w-xl space-y-4 rounded-xl border border-stone-200 bg-white p-5">
        <p className="text-stone-700">
          Communities is optional. Enable it to group delivery addresses, then Type (Community or Individual) appears on
          orders. Customers never see this.
        </p>
        {error ? <p className="text-red-700">{error}</p> : null}
        <ActionNotice message={notice.message} />
        <button
          type="button"
          disabled={busy}
          onClick={() => void setEnabled(true)}
          className="min-h-11 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {busy ? 'Enabling…' : 'Enable Communities'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {error ? <p className="w-full text-sm text-red-700">{error}</p> : null}
      <ActionNotice message={notice.message} />
      <button
        type="button"
        disabled={busy}
        onClick={() => void setEnabled(false)}
        className="text-sm font-medium text-stone-600 underline-offset-2 hover:underline disabled:opacity-60"
      >
        {busy ? 'Turning off…' : 'Turn off Communities'}
      </button>
    </div>
  );
}
