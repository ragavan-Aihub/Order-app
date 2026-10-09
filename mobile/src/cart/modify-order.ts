import type { CartItem } from '@/cart/CartContext';
import { cartItemsFromOrder, getMyOrderById } from '@/services/orders';
import { getAvailableProducts, getCachedProducts } from '@/services/products';
import type { Product } from '@/types/product';
import type { OrderWithItems } from '@/types/order';

/** Build cart lines from order rows only — no catalog fetch (fast path into cart). */
export function instantCartItemsForEdit(order: OrderWithItems): CartItem[] {
  return cartItemsFromOrder(order, []);
}

export async function loadOrderItemsForEdit(
  orderId: string,
  fallback?: OrderWithItems,
  catalog: Product[] = [],
): Promise<CartItem[] | null> {
  if (!orderId) {
    return null;
  }
  if (fallback?.id === orderId && fallback.order_items.length) {
    const products = catalog.length ? catalog : await getCachedProducts().catch(() => []);
    if (products.length) {
      return cartItemsFromOrder(fallback, products);
    }
    return cartItemsFromOrder(fallback, []);
  }
  const products = catalog.length ? catalog : await getAvailableProducts().catch(() => []);
  const order = await getMyOrderById(orderId);
  if (!order) {
    return fallback?.id === orderId ? cartItemsFromOrder(fallback, products) : null;
  }
  return cartItemsFromOrder(order, products);
}

/** Refresh cart lines with catalog images/prices when cache or network is ready. */
export async function enrichCartItemsForEdit(
  order: OrderWithItems,
  catalog: Product[] = [],
): Promise<CartItem[]> {
  let products = catalog;
  if (!products.length) {
    products = await getCachedProducts().catch(() => []);
  }
  if (!products.length) {
    products = await getAvailableProducts().catch(() => []);
  }
  return cartItemsFromOrder(order, products);
}
