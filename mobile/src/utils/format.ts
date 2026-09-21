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
  new: 'Placed',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const PAYMENT_LABELS: Record<string, string> = {
  pending: 'Pending',
  cash: 'Paid · Cash',
  upi: 'Paid · UPI',
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

export function formatPaymentMethod(method: string): string {
  return PAYMENT_LABELS[method] ?? method;
}

export function formatRefundStatus(status: string | null | undefined): string | null {
  if (status === 'pending') {
    return 'Refund pending';
  }
  if (status === 'refunded') {
    return 'Refunded';
  }
  return null;
}

export function displayPaymentStatus(order: {
  status?: string;
  payment_method?: string | null;
  refund_status?: string | null;
}): 'pending' | 'paid' | 'not_applicable' | 'refund_pending' | 'refunded' {
  const collected = order.payment_method === 'cash' || order.payment_method === 'upi';
  if (order.status === 'cancelled') {
    if (!collected) {
      return 'not_applicable';
    }
    return order.refund_status === 'refunded' ? 'refunded' : 'refund_pending';
  }
  return collected ? 'paid' : 'pending';
}

export function formatDisplayPayment(order: {
  status?: string;
  payment_method?: string | null;
  refund_status?: string | null;
}): string {
  switch (displayPaymentStatus(order)) {
    case 'paid':
      return order.payment_method === 'upi' ? 'Paid · UPI' : 'Paid · Cash';
    case 'not_applicable':
      return 'Not applicable';
    case 'refund_pending':
      return 'Refund pending';
    case 'refunded':
      return 'Refunded';
    default:
      return 'Pending';
  }
}

export function displayPaymentTone(status: ReturnType<typeof displayPaymentStatus>): { bg: string; fg: string } {
  switch (status) {
    case 'paid':
      return { bg: '#DCFCE7', fg: '#15803D' };
    case 'refunded':
    case 'refund_pending':
      return { bg: '#EDE9FE', fg: '#6D28D9' };
    case 'not_applicable':
      return { bg: '#F5F5F4', fg: '#57534E' };
    default:
      return { bg: '#FFEDD5', fg: '#C2410C' };
  }
}

export function paymentMethodTone(method: string): { bg: string; fg: string } {
  return displayPaymentTone(method === 'cash' || method === 'upi' ? 'paid' : 'pending');
}
