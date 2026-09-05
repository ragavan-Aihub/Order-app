export function formatPrice(amount: number): string {
  return `₹${Number(amount).toFixed(2)}`;
}

export function formatOrderNumber(orderNumber: number | string): string {
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

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export function formatOrderStatus(status: string): string {
  return STATUS_LABELS[status] ?? status;
}
