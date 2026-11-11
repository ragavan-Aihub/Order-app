import type { CartItem } from '@/cart/CartContext';
import type { Product } from '@/types/product';
import { sellingTypeOf } from '@/utils/selling-units';

type Listener = (productId: string) => void;

let pendingProductId: string | null = null;
const listeners = new Set<Listener>();
let expectCartItems = false;
let lastQueuedId = '';
let lastQueuedAt = 0;

export function queueAvailableProductOrder(productId: string) {
  const id = productId.trim();
  if (!id) {
    return;
  }
  const now = Date.now();
  if (id === lastQueuedId && now - lastQueuedAt < 2500) {
    return;
  }
  lastQueuedId = id;
  lastQueuedAt = now;
  pendingProductId = id;
  listeners.forEach((listener) => listener(id));
}

export function subscribeAvailableProductOrder(listener: Listener) {
  listeners.add(listener);
  if (pendingProductId) {
    listener(pendingProductId);
  }
  return () => {
    listeners.delete(listener);
  };
}

export function takeAvailableProductOrder() {
  const id = pendingProductId;
  pendingProductId = null;
  return id;
}

export function markExpectingCartItems() {
  expectCartItems = true;
}

export function shouldHoldEmptyCart() {
  return expectCartItems;
}

export function clearExpectingCartItems() {
  expectCartItems = false;
}

export function cartLineForAvailableProduct(product: Product): CartItem | null {
  if (product.available === false || product.active === false) {
    return null;
  }
  if (sellingTypeOf(product) !== 'quantity') {
    return null;
  }
  return {
    product,
    quantity: 1,
    weightGrams: null,
    volumeMl: null,
    packOptionId: null,
    packWeightGrams: null,
  };
}
