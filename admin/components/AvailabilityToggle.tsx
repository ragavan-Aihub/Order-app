'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Spinner, useActionNotice } from '@/components/ActionNotice';
import { updateProductAvailability } from '@/services/product-actions';

export function AvailabilityToggle({
  productId,
  available,
  disabled = false,
}: {
  productId: string;
  available: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(available);
  const [saving, setSaving] = useState(false);
  const notice = useActionNotice();

  useEffect(() => {
    setOn(available);
  }, [available]);

  async function onToggle() {
    if (saving || disabled) {
      return;
    }
    const next = !on;
    setSaving(true);
    const result = await updateProductAvailability(productId, next);
    setSaving(false);
    if (result.error) {
      return;
    }
    setOn(next);
    notice.show(next ? 'Product marked available' : 'Product marked unavailable');
    router.refresh();
  }

  return (
    <span className="inline-flex min-w-[10.5rem] flex-col items-start gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={on ? 'Available' : 'Coming soon'}
        disabled={saving || disabled}
        aria-busy={saving}
        onClick={onToggle}
        className="inline-flex w-[10.5rem] shrink-0 items-center gap-2 text-left disabled:opacity-60"
      >
        <span className={`relative h-7 w-11 shrink-0 rounded-full ${on ? 'bg-emerald-600' : 'bg-amber-400'}`}>
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white ${on ? 'left-5' : 'left-1'}`} />
        </span>
        <span
          className={`inline-flex w-[7.25rem] items-center gap-1.5 text-sm font-medium ${
            saving ? 'text-stone-600' : on ? 'text-emerald-800' : 'text-amber-800'
          }`}
        >
          {saving ? (
            <>
              <Spinner size={14} /> Saving…
            </>
          ) : on ? (
            'Available'
          ) : (
            'Coming soon'
          )}
        </span>
      </button>
    </span>
  );
}
