'use client';

import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';

import {
  ADMIN_PIECE_QTY_MAX,
  ADMIN_WEIGHT_QTY_MAX,
  formatLineMultiplier,
  isWeightSellingType,
  roundQty2,
} from '@/lib/selling-units';

function qtyLabel(quantity: number): string {
  return Number.isInteger(quantity) ? String(quantity) : String(roundQty2(quantity));
}

function parseWeightQty(raw: string, max: number): number | null {
  const trimmed = raw.trim();
  if (!trimmed || !/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }
  const next = roundQty2(Number(trimmed));
  if (!Number.isFinite(next) || next < 0.01 || next > max) {
    return null;
  }
  return next;
}

export function AdminQtyStepper({
  quantity,
  sellingType,
  productName,
  onChange,
}: {
  quantity: number;
  sellingType?: string | null;
  productName: string;
  onChange: (quantity: number) => void;
}) {
  const weight = isWeightSellingType(sellingType);
  const max = weight ? ADMIN_WEIGHT_QTY_MAX : ADMIN_PIECE_QTY_MAX;
  const minKeep = weight ? 0.01 : 1;
  const afterMinus = roundQty2(quantity - 1);
  const canMinus = afterMinus >= minKeep;
  const canPlus = roundQty2(quantity + 1) <= max;
  const [draft, setDraft] = useState<string | null>(null);

  function bump(delta: number) {
    const next = roundQty2(quantity + delta);
    if (next < minKeep || next > max) {
      return;
    }
    setDraft(null);
    onChange(next);
  }

  function commitDraft() {
    if (draft === null) {
      return;
    }
    const parsed = parseWeightQty(draft, max);
    if (parsed != null && parsed !== quantity) {
      onChange(parsed);
    }
    setDraft(null);
  }

  return (
    <div className="flex items-center rounded-lg border border-stone-200 bg-white">
      <button
        type="button"
        onClick={() => bump(-1)}
        disabled={!canMinus}
        className="inline-flex size-8 items-center justify-center rounded-l-lg text-stone-600 hover:bg-stone-50 disabled:opacity-40"
        aria-label={`Decrease ${productName}`}
      >
        <Minus size={14} />
      </button>
      {weight ? (
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={draft ?? qtyLabel(quantity)}
          onFocus={(event) => {
            setDraft(qtyLabel(quantity));
            event.target.select();
          }}
          onChange={(event) => {
            const raw = event.target.value.replace(',', '.').replace(/[^\d.]/g, '');
            if (raw.split('.').length > 2) {
              return;
            }
            const [whole, fraction] = raw.split('.');
            if (fraction != null && fraction.length > 2) {
              return;
            }
            if (whole.length > 3) {
              return;
            }
            setDraft(raw);
          }}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              (event.target as HTMLInputElement).blur();
            }
          }}
          className="w-14 border-0 bg-transparent p-0 text-center text-sm font-semibold tabular-nums text-stone-900 outline-none"
          aria-label={`${productName} quantity`}
        />
      ) : (
        <span className="w-8 text-center text-sm font-semibold tabular-nums">
          {formatLineMultiplier(quantity)}
        </span>
      )}
      <button
        type="button"
        onClick={() => bump(1)}
        disabled={!canPlus}
        className="inline-flex size-8 items-center justify-center rounded-r-lg text-stone-600 hover:bg-stone-50 disabled:opacity-40"
        aria-label={`Increase ${productName}`}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
