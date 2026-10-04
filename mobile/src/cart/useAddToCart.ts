import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { useCart } from '@/cart/CartContext';
import { setNewOrderIntent } from '@/cart/new-order-intent';
import type { Product } from '@/types/product';

export function useAddToCart() {
  const { addItem, openOrderBlock, refreshOpenOrder } = useCart();

  useFocusEffect(
    useCallback(() => {
      refreshOpenOrder();
    }, [refreshOpenOrder]),
  );

  return useCallback(
    (product: Product, quantity = 1) => {
      if (product.available === false) {
        return false;
      }
      if (openOrderBlock) {
        setNewOrderIntent({ product, quantity });
        router.push('/new-order');
        return false;
      }
      return addItem(product, quantity);
    },
    [addItem, openOrderBlock],
  );
}
