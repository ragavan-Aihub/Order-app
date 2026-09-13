export function formatPrice(amount: number): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    return '₹0';
  }
  if (Number.isInteger(value)) {
    return `₹${value}`;
  }
  return `₹${value.toFixed(2)}`;
}

export function formatOrderNumber(orderNumber: number | string): string {
  return String(orderNumber);
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return date.toLocaleString('en-IN');
  }
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  confirmed: 'Confirmed',
  preparing: 'Processing',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export function formatOrderStatus(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function orderStatusTone(status: string): { bg: string; fg: string } {
  switch (status) {
    case 'confirmed':
      return { bg: '#DBEAFE', fg: '#1D4ED8' };
    case 'preparing':
      return { bg: '#FFEDD5', fg: '#C2410C' };
    case 'delivered':
      return { bg: '#DCFCE7', fg: '#15803D' };
    case 'cancelled':
      return { bg: '#FEE2E2', fg: '#B91C1C' };
    default:
      return { bg: '#CCFBF1', fg: '#0F766E' };
  }
}
