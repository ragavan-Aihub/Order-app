import type { CartItem } from '@/cart/CartContext';
import { cartItemsFromOrder, getMyOrderById } from '@/services/orders';
import type { Product } from '@/types/product';
import type { OrderWithItems } from '@/types/order';

export async function loadOrderItemsForEdit(
  orderId: string,
  fallback?: OrderWithItems,
  catalog: Product[] = [],
): Promise<CartItem[] | null> {
  if (!orderId) {
    return null;
  }
  if (fallback?.id === orderId && fallback.order_items.length) {
    return cartItemsFromOrder(fallback, catalog);
  }
  const order = await getMyOrderById(orderId);
  if (!order) {
    return fallback?.id === orderId ? cartItemsFromOrder(fallback, catalog) : null;
  }
  return cartItemsFromOrder(order, catalog);
}
