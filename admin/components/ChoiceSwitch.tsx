'use client';

export function ChoiceSwitch({
  checked,
  onCheckedChange,
  title,
  description,
  tone = 'green',
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  title: string;
  description: string;
  tone?: 'green' | 'red';
}) {
  const active =
    tone === 'red' ? 'border-red-300 bg-red-50' : 'border-emerald-300 bg-emerald-50';
  const track = checked ? (tone === 'red' ? 'bg-red-600' : 'bg-emerald-600') : 'bg-stone-300';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left shadow-sm transition sm:gap-5 sm:px-5 sm:py-5 ${
        checked ? active : 'border-stone-200 bg-white hover:border-stone-300'
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-semibold text-stone-900">{title}</span>
        <span className="mt-1 block text-sm leading-6 text-stone-600">{description}</span>
      </span>
      <span className="flex shrink-0 flex-col items-center gap-1">
        <span className={`text-xs font-bold tracking-wide ${checked ? 'text-stone-900' : 'text-stone-500'}`}>
          {checked ? 'ON' : 'OFF'}
        </span>
        <span aria-hidden className={`relative h-10 w-16 rounded-full transition ${track}`}>
          <span
            className={`absolute top-1 h-8 w-8 rounded-full bg-white shadow transition ${
              checked ? 'left-7' : 'left-1'
            }`}
          />
        </span>
      </span>
    </button>
  );
}
