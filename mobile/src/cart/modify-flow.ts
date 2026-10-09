import { router } from 'expo-router';
import { Alert } from 'react-native';

import type { CartItem } from '@/cart/CartContext';
import {
  enrichCartItemsForEdit,
  instantCartItemsForEdit,
  loadOrderItemsForEdit,
} from '@/cart/modify-order';
import { openOrderCartMessage, selectAddressForOrder } from '@/cart/open-cart-guard';
import {
  canModifyOrder,
  isOpenOrderStatus,
  orderLockedMessage,
  type Order,
  type OrderStatus,
  type OrderWithItems,
} from '@/types/order';
import { formatOrderNumber } from '@/utils/format';

let modifyLock = false;
let modifyLockAt = 0;
const MODIFY_LOCK_MS = 8000;

export function tryLockModify() {
  const now = Date.now();
  if (modifyLock && now - modifyLockAt < MODIFY_LOCK_MS) {
    return false;
  }
  modifyLock = true;
  modifyLockAt = now;
  return true;
}

export function unlockModify() {
  modifyLock = false;
}

export function alertUpdateLimit(status: string) {
  Alert.alert('Modify limit reached', orderLockedMessage(status));
}

export function alertModifyDiscarded(status: OrderStatus | null, orderNumber: number | null) {
  const label = orderNumber ? `Order #${formatOrderNumber(orderNumber)}` : 'Your order';
  if (status === 'cancelled') {
    Alert.alert(`${label} was cancelled`, 'Your changes were not saved.');
    return;
  }
  if (status === 'delivered') {
    Alert.alert(`${label} was delivered`, 'Your changes were not saved.');
    return;
  }
  if (status === 'out_for_delivery') {
    Alert.alert(`${label} is out for delivery`, 'Your changes were not saved. The order will arrive as originally placed.');
    return;
  }
  Alert.alert(`${label} can no longer be changed`, 'Your changes were not saved.');
}

function orderWithItems(order: Order | OrderWithItems): OrderWithItems | undefined {
  if (!('order_items' in order) || !order.order_items.length) {
    return undefined;
  }
  return order;
}

function openCartForEdit(
  order: Order,
  items: CartItem[],
  beginEditOrder: (orderId: string, items: CartItem[], order?: Order) => void,
) {
  beginEditOrder(order.id, items, order);
  router.navigate({ pathname: '/cart', params: { focus: 'add' } });
}

function backgroundEnrichEdit(
  order: OrderWithItems,
  beginEditOrder: (orderId: string, items: CartItem[], order?: Order) => void,
) {
  void Promise.all([selectAddressForOrder(order).catch(() => undefined), enrichCartItemsForEdit(order)])
    .then(([, enriched]) => {
      if (enriched.length) {
        beginEditOrder(order.id, enriched, order);
      }
    })
    .catch(() => undefined);
}

function enterModifyOrder(
  order: Order | OrderWithItems,
  beginEditOrder: (orderId: string, items: CartItem[], order?: Order) => void,
) {
  if (!tryLockModify()) {
    return;
  }

  const snapshot = orderWithItems(order);
  if (snapshot) {
    const instant = instantCartItemsForEdit(snapshot);
    if (instant.length) {
      openCartForEdit(order, instant, beginEditOrder);
      backgroundEnrichEdit(snapshot, beginEditOrder);
      unlockModify();
      return;
    }
  }

  void loadOrderItemsForEdit(order.id, undefined)
    .then(async (next) => {
      if (next === null) {
        throw new Error('Could not load that order.');
      }
      await selectAddressForOrder(order).catch(() => undefined);
      openCartForEdit(order, next, beginEditOrder);
    })
    .catch((error) => {
      Alert.alert('Could not load', error instanceof Error ? error.message : 'Could not load that order.');
    })
    .finally(unlockModify);
}

export function goModifyOrder(
  order: Order | OrderWithItems,
  beginEditOrder: (orderId: string, items: CartItem[], order?: Order) => void,
  options?: { skipConfirm?: boolean },
) {
  if (!canModifyOrder(order)) {
    if (isOpenOrderStatus(order.status)) {
      alertUpdateLimit(order.status);
    } else {
      Alert.alert('Cannot modify', 'This order can no longer be changed.');
    }
    return;
  }

  if (options?.skipConfirm) {
    enterModifyOrder(order, beginEditOrder);
    return;
  }

  Alert.alert('Modify this order?', 'Open the cart to change items on this order?', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Modify order',
      onPress: () => {
        setTimeout(() => enterModifyOrder(order, beginEditOrder), 200);
      },
    },
  ]);
}

export function promptOpenOrderModify(
  order: Order,
  beginEditOrder: (orderId: string, items: CartItem[], order?: Order) => void,
) {
  Alert.alert('Open order', openOrderCartMessage(order), [
    { text: 'Not now', style: 'cancel' },
    {
      text: 'Modify',
      onPress: () => {
        setTimeout(() => {
          goModifyOrder(order, beginEditOrder, { skipConfirm: true });
        }, 200);
      },
    },
  ]);
}
