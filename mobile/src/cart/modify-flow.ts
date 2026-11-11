import { router } from 'expo-router';

import type { CartItem } from '@/cart/CartContext';
import { showAppDialog } from '@/components/AppDialogHost';
import {
  enrichCartItemsForEdit,
  instantCartItemsForEdit,
  loadOrderItemsForEdit,
} from '@/cart/modify-order';
import { openOrderCartMessage, selectAddressForOrder } from '@/cart/open-cart-guard';
import { isOrderShopModified } from '@/order-modifications/shop-modified';
import { getMyOrderById, getOrderModifications } from '@/services/orders';
import {
  canModifyOrder,
  isOpenOrderStatus,
  orderLockedMessage,
  orderShopModifiedMessage,
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
  showAppDialog({
    title: 'Modify limit reached',
    message: orderLockedMessage(status),
    icon: 'lock-closed',
    tone: 'warning',
  });
}

export function alertShopModified() {
  showAppDialog({
    title: 'Cannot modify',
    message: orderShopModifiedMessage(),
    icon: 'alert-circle',
    tone: 'warning',
  });
}

export function alertModifyDiscarded(status: OrderStatus | null, orderNumber: number | null) {
  const label = orderNumber ? `Order #${formatOrderNumber(orderNumber)}` : 'Your order';
  if (status === 'cancelled') {
    showAppDialog({
      title: `${label} was cancelled`,
      message: 'Your changes were not saved.',
      icon: 'close-circle',
      tone: 'danger',
    });
    return;
  }
  if (status === 'delivered') {
    showAppDialog({
      title: `${label} was delivered`,
      message: 'Your changes were not saved.',
      icon: 'checkmark-circle',
    });
    return;
  }
  if (status === 'out_for_delivery') {
    showAppDialog({
      title: `${label} is out for delivery`,
      message: 'Your changes were not saved. The order will arrive as originally placed.',
      icon: 'bicycle',
      tone: 'warning',
    });
    return;
  }
  showAppDialog({
    title: `${label} can no longer be changed`,
    message: 'Your changes were not saved.',
    icon: 'lock-closed',
    tone: 'warning',
  });
}

function orderWithItems(order: Order | OrderWithItems): OrderWithItems | undefined {
  if (!('order_items' in order) || !order.order_items.length) {
    return undefined;
  }
  return order;
}

type BeginEditOrder = (
  orderId: string,
  items: CartItem[],
  order?: Order,
  additions?: CartItem[],
) => void;

function openCartForEdit(
  order: Order,
  items: CartItem[],
  beginEditOrder: BeginEditOrder,
  additions?: CartItem[],
) {
  beginEditOrder(order.id, items, order, additions);
  router.navigate('/cart');
}

function backgroundEnrichEdit(
  order: OrderWithItems,
  beginEditOrder: BeginEditOrder,
  additions?: CartItem[],
) {
  void Promise.all([
    selectAddressForOrder(order).catch(() => undefined),
    enrichCartItemsForEdit(order),
    getMyOrderById(order.id),
  ])
    .then(([, enriched, fresh]) => {
      if (enriched.length) {
        beginEditOrder(order.id, enriched, fresh ?? order, additions);
      }
    })
    .catch(() => undefined);
}

function enterModifyOrder(
  order: Order | OrderWithItems,
  beginEditOrder: BeginEditOrder,
  additions?: CartItem[],
) {
  if (!tryLockModify() && !additions?.length) {
    return;
  }

  const snapshot = orderWithItems(order);
  if (snapshot) {
    const instant = instantCartItemsForEdit(snapshot);
    if (instant.length) {
      void getMyOrderById(order.id)
        .then((fresh) => {
          openCartForEdit(fresh ?? order, instant, beginEditOrder, additions);
          backgroundEnrichEdit(snapshot, beginEditOrder, additions);
        })
        .catch(() => {
          openCartForEdit(order, instant, beginEditOrder, additions);
          backgroundEnrichEdit(snapshot, beginEditOrder, additions);
        })
        .finally(unlockModify);
      return;
    }
  }

  void loadOrderItemsForEdit(order.id, undefined)
    .then(async (next) => {
      if (next === null) {
        throw new Error('Could not load that order.');
      }
      await selectAddressForOrder(order).catch(() => undefined);
      const fresh = (await getMyOrderById(order.id)) ?? order;
      openCartForEdit(fresh, next, beginEditOrder, additions);
    })
    .catch((error) => {
      showAppDialog({
        title: 'Could not load',
        message: error instanceof Error ? error.message : 'Could not load that order.',
        icon: 'cloud-offline',
        tone: 'warning',
      });
    })
    .finally(unlockModify);
}

async function canEnterCustomerModify(order: Order | OrderWithItems): Promise<boolean> {
  if (!canModifyOrder(order)) {
    if (isOpenOrderStatus(order.status)) {
      alertUpdateLimit(order.status);
    } else {
      showAppDialog({
        title: 'Cannot modify',
        message: 'This order can no longer be changed.',
        icon: 'lock-closed',
        tone: 'warning',
      });
    }
    return false;
  }

  try {
    const mods = await getOrderModifications(order.id);
    if (isOrderShopModified(mods)) {
      alertShopModified();
      return false;
    }
  } catch {
    showAppDialog({
      title: 'Cannot modify',
      message: 'Could not verify this order. Try again in a moment.',
      icon: 'cloud-offline',
      tone: 'warning',
    });
    return false;
  }

  return true;
}

export function goModifyOrder(
  order: Order | OrderWithItems,
  beginEditOrder: BeginEditOrder,
  options?: { skipConfirm?: boolean; additions?: CartItem[] },
) {
  void canEnterCustomerModify(order).then((allowed) => {
    if (!allowed) {
      return;
    }

    if (options?.skipConfirm) {
      enterModifyOrder(order, beginEditOrder, options.additions);
      return;
    }

    const orderLabel = order.order_number
      ? `order #${formatOrderNumber(order.order_number)}`
      : 'this order';
    showAppDialog({
      title: 'Modify this order?',
      message: options?.additions?.length
        ? `Add these items to ${orderLabel}? Your current order will be updated when you tap Update order.`
        : `Open the cart to change items on ${orderLabel}?`,
      icon: 'create',
      actions: [
        {
          label: 'Modify order',
          onPress: () => {
            enterModifyOrder(order, beginEditOrder, options?.additions);
          },
        },
      ],
    });
  });
}

export function promptOpenOrderModify(
  order: Order,
  beginEditOrder: BeginEditOrder,
) {
  showAppDialog({
    title: 'Open order',
    message: openOrderCartMessage(order),
    icon: 'bag-handle',
    actions: [
      {
        label: 'Modify',
        onPress: () => {
          goModifyOrder(order, beginEditOrder, { skipConfirm: true });
        },
      },
    ],
  });
}
