'use client';

import { useState } from 'react';

import { ActionNotice, useActionNotice } from '@/components/ActionNotice';
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
  const [on, setOn] = useState(available);
  const [saving, setSaving] = useState(false);
  const notice = useActionNotice();

  async function onToggle() {
    if (saving || disabled) {
      return;
    }
    const next = !on;
    setOn(next);
    setSaving(true);
    notice.clear();
    const result = await updateProductAvailability(productId, next);
    setSaving(false);
    if (result.error) {
      setOn(!next);
      return;
    }
    notice.show('Saved successfully');
  }

  return (
    <span className="inline-flex min-w-[10.5rem] flex-col items-start gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={on ? 'Available' : 'Coming soon'}
        disabled={saving || disabled}
        onClick={onToggle}
        className="inline-flex w-[10.5rem] shrink-0 items-center gap-2 text-left disabled:opacity-60"
      >
        <span className={`relative h-7 w-11 shrink-0 rounded-full ${on ? 'bg-emerald-600' : 'bg-amber-400'}`}>
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white ${on ? 'left-5' : 'left-1'}`} />
        </span>
        <span className={`w-[7.25rem] text-sm font-medium ${on ? 'text-emerald-800' : 'text-amber-800'}`}>
          {on ? 'Available' : 'Coming soon'}
        </span>
      </button>
      <ActionNotice message={notice.message} />
    </span>
  );
}
