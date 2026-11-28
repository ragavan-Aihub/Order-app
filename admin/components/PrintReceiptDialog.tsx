'use client';

import { useEffect, useState } from 'react';

import { Spinner } from '@/components/ActionNotice';
import type { ReceiptFormat } from '@/lib/order-receipt-html';
import { printOrderReceipt } from '@/lib/print-receipt';
import { getOrderReceiptPrintData } from '@/services/receipt-print-data';

export function PrintReceiptDialog({
  orderId,
  open,
  onClose,
  title = 'Print receipt?',
  body = 'Print this invoice now, or choose Not now and print later from the orders list.',
}: {
  orderId: string;
  open: boolean;
  onClose: () => void;
  title?: string;
  body?: string;
}) {
  const [busy, setBusy] = useState<ReceiptFormat | 'load' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setBusy(null);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) {
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose, open]);

  if (!open) {
    return null;
  }

  async function handlePrint(format: ReceiptFormat) {
    setBusy(format);
    setError(null);
    try {
      const result = await getOrderReceiptPrintData(orderId);
      if (result.error || !result.data) {
        setError(result.error || 'Could not load the receipt.');
        setBusy(null);
        return;
      }
      if (!result.data.canPrint) {
        setError('Save the invoice before printing this order.');
        setBusy(null);
        return;
      }
      printOrderReceipt({
        order: result.data.order,
        shop: result.data.shop,
        placedItems: result.data.placedItems,
        format,
        logoSrc: result.data.shop.logoUrl,
      });
      setBusy(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not print the receipt.');
      setBusy(null);
    }
  }

  const disabled = Boolean(busy);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={() => {
        if (!disabled) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
        <p className="mt-1.5 text-sm text-stone-600">{body}</p>
        {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void handlePrint('a4')}
            disabled={disabled}
            aria-busy={busy === 'a4'}
            autoFocus
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy === 'a4' ? <Spinner size={18} /> : null}
            {busy === 'a4' ? 'Preparing…' : 'Print A4'}
          </button>
          <button
            type="button"
            onClick={() => void handlePrint('thermal')}
            disabled={disabled}
            aria-busy={busy === 'thermal'}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-emerald-700 bg-white px-4 font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
          >
            {busy === 'thermal' ? <Spinner size={18} /> : null}
            {busy === 'thermal' ? 'Preparing…' : 'Print thermal'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={disabled}
            className="min-h-11 w-full rounded-lg border border-stone-300 px-4 font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
