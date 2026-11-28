'use client';

import { Printer } from 'lucide-react';
import { useState } from 'react';

import { PrintReceiptDialog } from '@/components/PrintReceiptDialog';

export function PrintReceiptButton({
  orderId,
  canPrint,
  variant = 'button',
  className = '',
}: {
  orderId: string;
  canPrint: boolean;
  variant?: 'button' | 'icon' | 'menu';
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!canPrint) {
    return null;
  }

  const label = 'Print receipt';

  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen(true);
          }}
          aria-label={label}
          title={label}
          className={`inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 ${className}`}
        >
          <Printer size={16} />
        </button>
      ) : (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen(true);
          }}
          className={
            className ||
            'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-700 hover:bg-stone-50'
          }
        >
          <Printer size={16} />
          {label}
        </button>
      )}
      <PrintReceiptDialog orderId={orderId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
