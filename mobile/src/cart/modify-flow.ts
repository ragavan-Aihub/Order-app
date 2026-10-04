import { router } from 'expo-router';
import { Alert } from 'react-native';

import type { CartItem } from '@/cart/CartContext';
import { loadOrderItemsForEdit } from '@/cart/modify-order';
import { openOrderCartMessage } from '@/cart/open-cart-guard';
import {
  ORDER_LOCKED_MESSAGE,
  canModifyOrder,
  isOpenOrderStatus,
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

export function alertUpdateLimit() {
  Alert.alert('Modify limit reached', ORDER_LOCKED_MESSAGE);
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

export function goModifyOrder(
  order: Order | OrderWithItems,
  beginEditOrder: (orderId: string, items: CartItem[]) => void,
) {
  if (!canModifyOrder(order)) {
    if (isOpenOrderStatus(order.status)) {
      alertUpdateLimit();
    } else {
      Alert.alert('Cannot modify', 'This order can no longer be changed.');
    }
    return;
  }
  if (!tryLockModify()) {
    return;
  }
  const fallback = 'order_items' in order ? order : undefined;
  void loadOrderItemsForEdit(order.id, fallback)
    .then((next) => {
      if (next === null) {
        throw new Error('Could not load that order.');
      }
      beginEditOrder(order.id, next);
      router.navigate('/cart');
    })
    .catch((error) => {
      Alert.alert('Could not load', error instanceof Error ? error.message : 'Could not load that order.');
    })
    .finally(unlockModify);
}

export function promptOpenOrderModify(
  order: Order,
  beginEditOrder: (orderId: string, items: CartItem[]) => void,
) {
  Alert.alert('Open order', openOrderCartMessage(order), [
    { text: 'Not now', style: 'cancel' },
    {
      text: 'Modify',
      onPress: () => {
        setTimeout(() => {
          goModifyOrder(order, beginEditOrder);
        }, 200);
      },
    },
  ]);
}
