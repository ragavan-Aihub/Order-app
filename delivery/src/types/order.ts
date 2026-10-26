export type OrderStatus =
  | 'new'
  | 'confirmed'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type PaymentMethod = 'pending' | 'cash' | 'upi';

export type Order = {
  id: string;
  order_number: number;
  business_id: string;
  customer_name: string;
  mobile: string;
  delivery_address: string;
  pincode: string;
  total_amount: number;
  status: OrderStatus;
  payment_method: PaymentMethod;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderItem = {
  id: string;
  product_name: string;
  quantity: number;
  subtotal: number;
};

export type OrderWithItems = Order & {
  order_items: OrderItem[];
};

export const ORDER_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: 'new', label: 'Placed' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'out_for_delivery', label: 'Out for delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  new: ['confirmed', 'cancelled'],
  confirmed: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export function orderStatusLabel(status: string): string {
  const value = status === 'preparing' ? 'confirmed' : status;
  return ORDER_STATUSES.find((item) => item.value === value)?.label ?? status;
}
