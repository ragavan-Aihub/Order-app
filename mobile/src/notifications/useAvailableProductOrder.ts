import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/cart/CartContext';
import { showAppDialog } from '@/components/AppDialogHost';
import { goModifyOrder } from '@/cart/modify-flow';
import { findOpenOrderForSelectedAddress } from '@/cart/open-cart-guard';
import {
  cartLineForAvailableProduct,
  markExpectingCartItems,
  subscribeAvailableProductOrder,
  takeAvailableProductOrder,
} from '@/notifications/available-product-order';
import { fetchProductByIdLive, invalidateProductCatalogCache } from '@/services/products';
import { canModifyOrder, isOpenOrderStatus } from '@/types/order';
import { formatOrderNumber } from '@/utils/format';
import { sellingTypeOf } from '@/utils/selling-units';

/** After a “now available” push tap: add the product and open cart, or offer modify. */
export function useAvailableProductOrder() {
  const router = useRouter();
  const {
    addItem,
    beginEditOrder,
    cartReady,
    editingOrderId,
    openOrderReady,
    refreshOpenOrder,
  } = useCart();
  const [queuedId, setQueuedId] = useState<string | null>(null);
  const busyRef = useRef(false);

  useEffect(() => subscribeAvailableProductOrder(setQueuedId), []);

  useEffect(() => {
    if (!queuedId || !cartReady || !openOrderReady || busyRef.current) {
      return;
    }
    busyRef.current = true;
    takeAvailableProductOrder();
    const productId = queuedId;
    setQueuedId(null);
    void (async () => {
      try {
        refreshOpenOrder();
        invalidateProductCatalogCache();
        const product = await fetchProductByIdLive(productId);
        if (!product || product.available === false || product.active === false) {
          showAppDialog({
            title: 'Not available yet',
            message: 'This item is not ready to order. Try again in a moment.',
            icon: 'time',
            tone: 'warning',
          });
          router.replace('/home');
          return;
        }
        if (sellingTypeOf(product) !== 'quantity') {
          router.push({
            pathname: '/product/[id]',
            params: { id: product.id, fromAvailablePush: '1' },
          });
          return;
        }
        const line = cartLineForAvailableProduct(product);
        if (!line) {
          router.push({ pathname: '/product/[id]', params: { id: product.id } });
          return;
        }
        const blocking = await findOpenOrderForSelectedAddress(true);
        if (blocking && editingOrderId === blocking.id) {
          markExpectingCartItems();
          addItem(product, 1);
          router.navigate('/cart');
          return;
        }
        if (blocking && isOpenOrderStatus(blocking.status) && canModifyOrder(blocking)) {
          showAppDialog({
            title: 'Update your order?',
            message: `${product.name} is available. Add it to order #${formatOrderNumber(blocking.order_number)} and update?`,
            icon: 'create',
            actions: [
              {
                label: 'Modify order',
                onPress: () => {
                  markExpectingCartItems();
                  goModifyOrder(blocking, beginEditOrder, { skipConfirm: true, additions: [line] });
                },
              },
            ],
          });
          return;
        }
        if (blocking) {
          showAppDialog({
            title: 'Order already placed',
            message: `Order #${formatOrderNumber(blocking.order_number)} can no longer be changed.`,
            icon: 'lock-closed',
            tone: 'warning',
          });
          return;
        }
        markExpectingCartItems();
        addItem(product, 1);
        router.navigate('/cart');
      } catch {
        showAppDialog({
          title: 'Could not add',
          message: 'Could not add this item. Open it from Home and try again.',
          icon: 'alert-circle',
          tone: 'warning',
        });
        router.replace('/home');
      } finally {
        busyRef.current = false;
      }
    })();
  }, [
    addItem,
    beginEditOrder,
    cartReady,
    editingOrderId,
    openOrderReady,
    queuedId,
    refreshOpenOrder,
    router,
  ]);
}
