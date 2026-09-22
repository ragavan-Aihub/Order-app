export function formatPrice(amount: number): string {
  return `₹${Number(amount).toFixed(2)}`;
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
