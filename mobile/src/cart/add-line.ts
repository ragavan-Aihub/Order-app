import type { CartItem } from '@/cart/CartContext';
import type { Product } from '@/types/product';

export type CartAddExtras = {
  weightGrams?: number;
  volumeMl?: number;
  packOptionId?: string;
  packWeightGrams?: number;
};

export function cartItemFromAdd(
  product: Product,
  quantity = 1,
  extras?: CartAddExtras,
): CartItem {
  return {
    product,
    quantity: Math.max(1, Math.floor(quantity)),
    weightGrams: extras?.weightGrams ?? null,
    volumeMl: extras?.volumeMl ?? null,
    packOptionId: extras?.packOptionId ?? null,
    packWeightGrams: extras?.packWeightGrams ?? null,
  };
}
