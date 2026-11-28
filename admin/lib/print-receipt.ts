import { buildOrderReceiptHtml, type ReceiptFormat, type ReceiptOrder, type ReceiptShop } from '@/lib/order-receipt-html';
import type { PrintSettings } from '@/lib/print-settings';
import type { OrderModificationItemSnapshot } from '@/types/order';

export type PrintReceiptInput = {
  order: ReceiptOrder;
  shop: ReceiptShop;
  placedItems?: OrderModificationItemSnapshot[];
  format: ReceiptFormat;
  logoSrc?: string | null;
  settings?: PrintSettings | null;
};

/** Open a hidden iframe, print the receipt HTML, then clean up. */
export function printOrderReceipt(input: PrintReceiptInput): void {
  if (typeof window === 'undefined') {
    return;
  }

  const html = buildOrderReceiptHtml(input.order, input.shop, {
    format: input.format,
    placedItems: input.placedItems,
    logoSrc: input.logoSrc,
    settings: input.settings,
  });

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDocument = frameWindow?.document;
  if (!frameWindow || !frameDocument) {
    iframe.remove();
    throw new Error('Could not open the print dialog.');
  }

  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();

  const cleanup = () => {
    window.setTimeout(() => iframe.remove(), 500);
  };

  const triggerPrint = () => {
    try {
      frameWindow.focus();
      frameWindow.print();
    } finally {
      cleanup();
    }
  };

  // Allow images/styles to settle before invoking the system print dialog.
  window.setTimeout(triggerPrint, 250);
}
