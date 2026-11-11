import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { cartItemFromAdd, type CartAddExtras } from '@/cart/add-line';
import { showAppDialog } from '@/components/AppDialogHost';
import { useCart } from '@/cart/CartContext';
import { goModifyOrder } from '@/cart/modify-flow';
import { markExpectingCartItems } from '@/notifications/available-product-order';
import type { Product } from '@/types/product';
import { canModifyOrder } from '@/types/order';
import { formatOrderNumber } from '@/utils/format';

export function useAddToCart() {
  const { addItem, beginEditOrder, editingOrderId, openOrderBlock, refreshOpenOrder } = useCart();

  useFocusEffect(
    useCallback(() => {
      refreshOpenOrder();
    }, [refreshOpenOrder]),
  );

  return useCallback(
    (product: Product, quantity = 1, extras?: CartAddExtras) => {
      if (product.available === false) {
        return false;
      }
      const blocking = openOrderBlock;
      if (blocking) {
        if (!canModifyOrder(blocking)) {
          showAppDialog({
            title: 'Order already placed',
            message: `Order #${formatOrderNumber(blocking.order_number)} can no longer be changed.`,
            icon: 'lock-closed',
            tone: 'warning',
          });
          return false;
        }
        markExpectingCartItems();
        if (editingOrderId === blocking.id) {
          addItem(product, quantity, extras);
          router.navigate('/cart');
          return true;
        }
        goModifyOrder(blocking, beginEditOrder, {
          additions: [cartItemFromAdd(product, quantity, extras)],
        });
        return true;
      }
      return addItem(product, quantity, extras);
    },
    [addItem, beginEditOrder, editingOrderId, openOrderBlock],
  );
}
