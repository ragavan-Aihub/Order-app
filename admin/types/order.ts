export type OrderStatus = 'new' | 'confirmed' | 'preparing' | 'delivered' | 'cancelled';

export type PaymentMethod = 'pending' | 'cash' | 'upi';

export type RefundStatus = 'pending' | 'refunded';

export type Order = {
  id: string;
  order_number: number;
  business_id: string;
  user_id: string | null;
  customer_id: string | null;
  customer_name: string;
  mobile: string;
  delivery_address: string;
  pincode: string;
  total_amount: number;
  status: OrderStatus;
  payment_method: PaymentMethod;
  cancel_reason: string | null;
  refund_status: RefundStatus | null;
  channel: string;
  external_id: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  product_price: number;
  quantity: number;
  subtotal: number;
  created_at: string;
};

export type OrderWithItems = Order & {
  order_items: OrderItem[];
  status_events: OrderStatusEvent[];
};

export type OrderStatusEvent = {
  id: string;
  order_id: string;
  status: string;
  note: string | null;
  created_at: string;
};

export const ORDER_CHANNELS: { value: string; label: string }[] = [
  { value: 'app', label: 'App' },
  { value: 'admin', label: 'Admin' },
  { value: 'api', label: 'Partner API' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

export const ORDER_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'preparing', label: 'Processing' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
];

export const COLLECTABLE_PAYMENT_METHODS: { value: Exclude<PaymentMethod, 'pending'>; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
];

export function isPaymentCollected(method: string | null | undefined): boolean {
  return method === 'cash' || method === 'upi';
}

export type DisplayPaymentStatus = 'pending' | 'paid' | 'not_applicable' | 'refund_pending' | 'refunded';

export const DISPLAY_PAYMENT_STATUSES: { value: DisplayPaymentStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'not_applicable', label: 'Not Applicable' },
  { value: 'refund_pending', label: 'Refund pending' },
  { value: 'refunded', label: 'Refunded' },
];

export function displayPaymentStatus(order: {
  status: string;
  payment_method?: string | null;
  refund_status?: string | null;
}): DisplayPaymentStatus {
  const collected = isPaymentCollected(order.payment_method);
  if (order.status === 'cancelled') {
    if (!collected) {
      return 'not_applicable';
    }
    return order.refund_status === 'refunded' ? 'refunded' : 'refund_pending';
  }
  return collected ? 'paid' : 'pending';
}

export function paymentStatusLabel(order: {
  status: string;
  payment_method?: string | null;
  refund_status?: string | null;
}): string {
  const value = displayPaymentStatus(order);
  return DISPLAY_PAYMENT_STATUSES.find((item) => item.value === value)?.label ?? value;
}

export function orderStatusLabel(status: string): string {
  return ORDER_STATUSES.find((item) => item.value === status)?.label ?? status;
}

export function orderStatusBadgeClass(status: string): string {
  switch (status) {
    case 'delivered':
      return 'bg-emerald-100 text-emerald-800';
    case 'preparing':
      return 'bg-amber-100 text-amber-800';
    case 'confirmed':
      return 'bg-sky-100 text-sky-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-teal-100 text-teal-800';
  }
}

export function paymentStatusBadgeClass(status: DisplayPaymentStatus): string {
  switch (status) {
    case 'paid':
      return 'bg-emerald-100 text-emerald-800';
    case 'refunded':
    case 'refund_pending':
      return 'bg-violet-100 text-violet-800';
    case 'not_applicable':
      return 'bg-stone-100 text-stone-600';
    default:
      return 'bg-amber-100 text-amber-800';
  }
}

export function paymentModeLabel(method: string | null | undefined): string {
  if (method === 'cash') {
    return 'Cash';
  }
  if (method === 'upi') {
    return 'UPI';
  }
  return '—';
}

export function refundStatusLabel(status: string | null | undefined): string {
  if (status === 'refunded') {
    return 'Refunded';
  }
  if (status === 'pending') {
    return 'Refund pending';
  }
  return '—';
}

export function paymentSummary(order: {
  status: string;
  payment_method?: string | null;
  refund_status?: string | null;
}): string {
  const status = paymentStatusLabel(order);
  const method = isPaymentCollected(order.payment_method) ? paymentModeLabel(order.payment_method) : null;
  if (method && status !== 'Not Applicable') {
    return `${status} · ${method}`;
  }
  return status;
}

export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  new: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'delivered', 'cancelled'],
  preparing: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export const CANCEL_REASON_PRESETS = [
  'Customer requested',
  'Item unavailable',
  'Could not deliver',
  'Duplicate order',
] as const;
