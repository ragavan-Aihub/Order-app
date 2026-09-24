'use client';

import { useState } from 'react';

import { updateProductAvailability } from '@/services/product-actions';

export function AvailabilityToggle({
  productId,
  available,
}: {
  productId: string;
  available: boolean;
}) {
  const [on, setOn] = useState(available);
  const [saving, setSaving] = useState(false);

  async function onToggle() {
    if (saving) {
      return;
    }
    const next = !on;
    setOn(next);
    setSaving(true);
    const result = await updateProductAvailability(productId, next);
    setSaving(false);
    if (result.error) {
      setOn(!next);
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? 'Available' : 'Unavailable'}
      disabled={saving}
      onClick={onToggle}
      className="inline-flex w-[9.5rem] shrink-0 items-center gap-2 text-left disabled:opacity-60"
    >
      <span
        className={`relative h-7 w-11 shrink-0 rounded-full ${on ? 'bg-emerald-600' : 'bg-stone-300'}`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white ${on ? 'left-5' : 'left-1'}`}
        />
      </span>
      <span className={`w-[6.25rem] text-sm font-medium ${on ? 'text-emerald-800' : 'text-stone-500'}`}>
        {on ? 'Available' : 'Unavailable'}
      </span>
    </button>
  );
}
