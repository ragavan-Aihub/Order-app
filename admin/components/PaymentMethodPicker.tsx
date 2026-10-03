'use client';

import { Banknote, Clock, Smartphone } from 'lucide-react';

export type PaymentChoice = 'cash' | 'upi' | 'later';

const CHOICES: { value: PaymentChoice; label: string; Icon: typeof Banknote }[] = [
  { value: 'cash', label: 'Cash', Icon: Banknote },
  { value: 'upi', label: 'UPI', Icon: Smartphone },
  { value: 'later', label: 'Not yet', Icon: Clock },
];

export function PaymentMethodPicker<T extends PaymentChoice>({
  value,
  onChange,
  allowLater = false,
  size = 'md',
}: {
  value: T | null;
  onChange: (value: T) => void;
  allowLater?: boolean;
  size?: 'md' | 'segmented';
}) {
  const options = CHOICES.filter((item) => allowLater || item.value !== 'later');
  const segmented = size === 'segmented';
  return (
    <div
      className={
        segmented
          ? 'flex w-full rounded-lg bg-stone-100 p-1'
          : `grid gap-2 ${options.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`
      }
      role="radiogroup"
      aria-label="Payment method"
    >
      {options.map(({ value: option, label, Icon }) => {
        const selected = value === option;
        const later = option === 'later';
        const className = segmented
          ? `flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors ${
              selected
                ? `bg-white shadow-sm ring-1 ring-stone-200 ${later ? 'text-amber-700' : 'text-emerald-700'}`
                : 'text-stone-600 hover:text-stone-900'
            }`
          : `flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border-2 text-sm font-semibold ${
              selected
                ? later
                  ? 'border-amber-500 bg-amber-50 text-amber-800'
                  : 'border-emerald-600 bg-emerald-50 text-emerald-800'
                : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
            }`;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option as T)}
            className={className}
          >
            <Icon size={segmented ? 15 : 20} aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
