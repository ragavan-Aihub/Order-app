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

export function formatOrderNumber(orderNumber: number): string {
  return String(orderNumber);
}

export function formatOrderListDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    }).format(date);
  } catch {
    return date.toLocaleString('en-IN');
  }
}