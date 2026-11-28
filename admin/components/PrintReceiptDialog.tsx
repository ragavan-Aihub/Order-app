'use client';

import { useEffect, useState } from 'react';

import { Spinner } from '@/components/ActionNotice';
import type { ReceiptFormat } from '@/lib/order-receipt-html';
import { DEFAULT_PRINT_SETTINGS, type PrintSettings } from '@/lib/print-settings';
import { printOrderReceipt } from '@/lib/print-receipt';
import { getOrderReceiptPrintData } from '@/services/receipt-print-data';

export function PrintReceiptDialog({
  orderId,
  open,
  onClose,
  title = 'Print receipt?',
  body = 'Print this invoice now, or choose Not now and print later from the orders list.',
  autoPrintDefault = false,
}: {
  orderId: string;
  open: boolean;
  onClose: () => void;
  title?: string;
  body?: string;
  /** When true, print the saved default format as soon as the dialog opens. */
  autoPrintDefault?: boolean;
}) {
  const [busy, setBusy] = useState<ReceiptFormat | 'load' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS);

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

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setBusy('load');
    void (async () => {
      const result = await getOrderReceiptPrintData(orderId);
      if (cancelled) {
        return;
      }
      if (result.error || !result.data) {
        setError(result.error || 'Could not load the receipt.');
        setBusy(null);
        return;
      }
      setSettings(result.data.settings);
      if (autoPrintDefault) {
        try {
          if (!result.data.canPrint) {
            setError('Save the invoice before printing this order.');
            setBusy(null);
            return;
          }
          printOrderReceipt({
            order: result.data.order,
            shop: result.data.shop,
            placedItems: result.data.placedItems,
            format: result.data.settings.defaultFormat,
            logoSrc: result.data.shop.logoUrl,
            settings: result.data.settings,
          });
          setBusy(null);
          onClose();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not print the receipt.');
          setBusy(null);
        }
        return;
      }
      setBusy(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [autoPrintDefault, onClose, open, orderId]);

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
        settings: result.data.settings,
      });
      setBusy(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not print the receipt.');
      setBusy(null);
    }
  }

  const disabled = Boolean(busy);
  const primaryFormat = settings.defaultFormat;
  const secondaryFormat: ReceiptFormat = primaryFormat === 'a4' ? 'thermal' : 'a4';
  const labelFor = (format: ReceiptFormat) => (format === 'a4' ? 'Print A4' : 'Print thermal');

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
          {busy === 'load' ? (
            <p className="inline-flex min-h-11 items-center justify-center gap-2 text-sm text-stone-600">
              <Spinner size={18} /> Loading print settings…
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void handlePrint(primaryFormat)}
                disabled={disabled}
                aria-busy={busy === primaryFormat}
                autoFocus
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy === primaryFormat ? <Spinner size={18} /> : null}
                {busy === primaryFormat ? 'Preparing…' : `${labelFor(primaryFormat)} (default)`}
              </button>
              <button
                type="button"
                onClick={() => void handlePrint(secondaryFormat)}
                disabled={disabled}
                aria-busy={busy === secondaryFormat}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-emerald-700 bg-white px-4 font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
              >
                {busy === secondaryFormat ? <Spinner size={18} /> : null}
                {busy === secondaryFormat ? 'Preparing…' : labelFor(secondaryFormat)}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={disabled}
                className="min-h-11 w-full rounded-lg border border-stone-300 px-4 font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
              >
                Not now
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
