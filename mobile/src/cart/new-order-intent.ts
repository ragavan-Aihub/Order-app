import type { Product } from '@/types/product';

type NewOrderIntent = { product: Product; quantity: number };

let intent: NewOrderIntent | null = null;

export function setNewOrderIntent(next: NewOrderIntent) {
  intent = next;
}

export function takeNewOrderIntent() {
  const current = intent;
  intent = null;
  return current;
}

export function clearNewOrderIntent() {
  intent = null;
}
