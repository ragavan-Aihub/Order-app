export function formatPrice(amount: number): string {
  return `₹${Number(amount).toFixed(2)}`;
}

export function formatSignedPrice(amount: number): string {
  const value = Math.round(Number(amount) * 100) / 100;
  if (Math.abs(value) < 0.005) {
    return formatPrice(0);
  }
  const formatted = formatPrice(Math.abs(value));
  return value > 0 ? `+${formatted}` : `-${formatted}`;
}

/** + difference green, − difference red, unchanged stays default. */
export function signedPriceClass(amount: number): string {
  const value = Math.round(Number(amount) * 100) / 100;
  if (value > 0.005) {
    return 'text-emerald-700';
  }
  if (value < -0.005) {
    return 'text-rose-700';
  }
  return '';
}

export function formatOrderNumber(orderNumber: number | string | null | undefined): string {
  if (orderNumber == null || orderNumber === '') {
    return '—';
  }
  return String(orderNumber);
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatStepTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

const ORDER_NOTES_MARKER = '\n\nOrder notes: ';

export function splitDeliveryNotes(deliveryAddress: string) {
  const index = deliveryAddress.indexOf(ORDER_NOTES_MARKER);
  if (index === -1) {
    return { address: deliveryAddress, notes: null as string | null };
  }
  return {
    address: deliveryAddress.slice(0, index),
    notes: deliveryAddress.slice(index + ORDER_NOTES_MARKER.length),
  };
}
