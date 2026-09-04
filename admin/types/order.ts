export type OrderStatus = 'new' | 'confirmed' | 'preparing' | 'delivered' | 'cancelled';

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
  created_at: string;
  updated_at: string;
};
