export type OrderStatus = 'new' | 'confirmed' | 'preparing' | 'delivered' | 'cancelled';

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
  total_amount: number;
  status: OrderStatus;
  payment_method: PaymentMethod;
  cancel_reason: string | null;
  refund_status: RefundStatus | null;
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
};
