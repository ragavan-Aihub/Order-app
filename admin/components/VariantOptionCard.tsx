import type { ReactNode } from 'react';

export function VariantOptionRow({ children }: { children: ReactNode }) {
  return <div className="flex max-w-full gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:thin]">{children}</div>;
}

export function VariantOptionCard({
  label,
  price,
  on,
  onClick,
  showPrice = true,
}: {
  label: string;
  price?: string;
  on: boolean;
  onClick: () => void;
  showPrice?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-semibold transition ${
        on
          ? 'border-emerald-700 bg-emerald-700 text-white'
          : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
      }`}
    >
      {label}
      {showPrice && price ? (
        <span className={`text-xs font-medium ${on ? 'text-emerald-100' : 'text-stone-400'}`}>{price}</span>
      ) : null}
    </button>
  );
}
