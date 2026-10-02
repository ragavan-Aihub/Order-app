import { router } from 'expo-router';
import { Alert } from 'react-native';

import type { CartItem } from '@/cart/CartContext';
import { loadOrderItemsForEdit } from '@/cart/modify-order';
import { openOrderCartMessage } from '@/cart/open-cart-guard';
import type { Order, OrderWithItems } from '@/types/order';

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

export function goModifyOrder(
  orderId: string,
  beginEditOrder: (orderId: string, items: CartItem[]) => void,
  fallback?: OrderWithItems,
) {
  if (!tryLockModify()) {
    return;
  }
  void loadOrderItemsForEdit(orderId, fallback)
    .then((next) => {
      if (next === null) {
        throw new Error('Could not load that order.');
      }
      beginEditOrder(orderId, next);
      router.push('/sam');
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
          goModifyOrder(order.id, beginEditOrder);
        }, 200);
      },
    },
  ]);
}
