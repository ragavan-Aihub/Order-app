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
