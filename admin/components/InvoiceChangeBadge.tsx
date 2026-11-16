import {
  invoiceLineChangeLabel,
  invoiceOrderChangeLabel,
  type InvoiceLineChange,
  type InvoiceOrderChange,
} from '@/lib/invoice-change';

function tone(change: InvoiceLineChange | InvoiceOrderChange): string {
  switch (change) {
    case 'no_difference':
      return 'text-stone-600';
    case 'excess':
    case 'added':
      return 'bg-emerald-100 text-emerald-900';
    case 'short':
      return 'bg-amber-100 text-amber-950';
    case 'removed':
      return 'bg-rose-100 text-rose-900';
    case 'mixed':
      return 'bg-sky-100 text-sky-950';
  }
}

function label(change: InvoiceLineChange | InvoiceOrderChange): string {
  if (change === 'mixed') {
    return invoiceOrderChangeLabel(change);
  }
  return invoiceLineChangeLabel(change);
}

export function InvoiceChangeBadge({
  change,
}: {
  change: InvoiceLineChange | InvoiceOrderChange;
}) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-semibold ${tone(change)}`}>
      {label(change)}
    </span>
  );
}
