export type OrderStatus =
  | 'new'
  | 'confirmed'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export const OPEN_ORDER_STATUSES: OrderStatus[] = ['new', 'confirmed'];

export function isOpenOrderStatus(status: string) {
  return OPEN_ORDER_STATUSES.includes(status as OrderStatus);
}

export function isUndeliveredOrder(status: string) {
  return status !== 'delivered' && status !== 'cancelled';
}

const MAX_ORDER_UPDATES = 5;

export function canCancelOrder(status: string) {
  return status === 'new';
}

export function orderLockedMessage(status: string) {
  return canCancelOrder(status)
    ? 'Modify limit reached for this order. You can still cancel it.'
    : 'Modify limit reached for this order.';
}

export function canModifyOrder(order: Pick<Order, 'status' | 'update_count'> | null | undefined) {
  return Boolean(order && isOpenOrderStatus(order.status) && (order.update_count ?? 0) < MAX_ORDER_UPDATES);
}

export type OrderPlacedVia = 'app' | 'voice';

export type PaymentMethod = 'pending' | 'cash' | 'upi';

export type RefundStatus = 'pending' | 'refunded';

export type Order = {
  id: string;
  order_number: number;
  business_id: string;
  user_id: string;
  customer_name: string;
  mobile: string;
  delivery_address: string;
  pincode: string;
  customer_address_id?: string | null;
  total_amount: number;
  status: OrderStatus;
  payment_method: PaymentMethod;
  cancel_reason: string | null;
  refund_status: RefundStatus | null;
  placed_via?: OrderPlacedVia;
  update_count?: number;
  items_revision?: number;
  created_at: string;
  updated_at: string;
};

export type OrderModificationActor = 'customer' | 'admin';

export type OrderModificationItemSnapshot = {
  product_id: string | null;
  product_name: string;
  product_price: number;
  quantity: number;
  subtotal: number;
};

export type OrderModification = {
  id: string;
  order_id: string;
  actor_type: OrderModificationActor;
  reason: string | null;
  previous_items: OrderModificationItemSnapshot[];
  new_items: OrderModificationItemSnapshot[];
  previous_total: number;
  new_total: number;
  payment_method: PaymentMethod;
  created_at: string;
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

export type OrderStatusEvent = {
  status: string;
  created_at: string;
};

export type OrderWithItems = Order & {
  order_items: OrderItem[];
  status_events?: OrderStatusEvent[];
};
