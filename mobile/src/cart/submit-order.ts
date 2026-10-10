import type { CartItem } from '@/cart/CartContext';
import { formatAddressForOrder, type SavedAddress } from '@/cart/address-book';
import { isNetworkFailure } from '@/services/network';
import {
  findOpenOrderForAddress,
  getMyOrderById,
  placeOrder,
  replaceOpenOrderItems,
} from '@/services/orders';
import { getSignedInUser } from '@/services/supabase';
import { ORDER_SHOP_MODIFIED_MESSAGE, type Order, OrderPlacedVia } from '@/types/order';

export type SubmitOrderResult =
  | { ok: true; order: Order }
  | {
      ok: false;
      reason: 'empty' | 'address' | 'auth' | 'unavailable' | 'network' | 'error' | 'open_order' | 'locked';
      message: string;
      openOrder?: Order;
    };

export async function submitShopOrder(
  items: CartItem[],
  selected: SavedAddress | null,
  editingOrderId?: string | null,
  placedVia: OrderPlacedVia = 'app',
  expectedItemsRevision?: number | null,
): Promise<SubmitOrderResult> {
  if (items.length === 0) {
    return { ok: false, reason: 'empty', message: 'Your cart is empty.' };
  }
  if (!selected) {
    return { ok: false, reason: 'address', message: 'Add a delivery address.' };
  }
  const blocked = items.find((item) => item.product.available === false);
  if (blocked) {
    return {
      ok: false,
      reason: 'unavailable',
      message: `${blocked.product.name} is coming soon or no longer sold. Remove it from the cart.`,
    };
  }

  const details = {
    name: selected.name,
    mobile: selected.mobile,
    address: formatAddressForOrder(selected),
    pincode: selected.pincode,
    addressId: selected.id,
  };

  try {
    if (editingOrderId) {
      const order = await replaceOpenOrderItemsWithFreshRevision(
        editingOrderId,
        items,
        details,
        expectedItemsRevision,
      );
      return { ok: true, order };
    }

    const user = await getSignedInUser();
    if (!user) {
      return { ok: false, reason: 'auth', message: 'Sign in to place your order.' };
    }

    const order = await placeOrder(details, items, placedVia);
    return { ok: true, order };
  } catch (placeError) {
    const message = placeError instanceof Error ? placeError.message : 'Could not place the order.';
    if (editingOrderId && /ORDER_STALE/i.test(message)) {
      return {
        ok: false,
        reason: 'error',
        message: 'This order changed while you were editing. Pull to refresh, review your cart, and try again.',
      };
    }
    if (editingOrderId && /cannot be changed/i.test(message)) {
      return { ok: false, reason: 'locked', message };
    }
    if (editingOrderId && message.includes(ORDER_SHOP_MODIFIED_MESSAGE)) {
      return { ok: false, reason: 'locked', message: ORDER_SHOP_MODIFIED_MESSAGE };
    }
    if (message === 'OPEN_ORDER' || /duplicate key|one_open_per_address/i.test(message)) {
      const open = await findOpenOrderForAddress({
        addressId: selected.id,
        address: details.address,
        pincode: selected.pincode,
      });
      return {
        ok: false,
        reason: 'open_order',
        openOrder: open ?? undefined,
        message: open
          ? `You already have order #${open.order_number} for this address. Edit that order, or place a new order at another address.`
          : 'You already have an open order for this address. Edit that order, or place a new order at another address.',
      };
    }
    if (message.toLowerCase().includes('sign in')) {
      return { ok: false, reason: 'auth', message };
    }
    if (isNetworkFailure(placeError) || isNetworkFailure(message)) {
      return { ok: false, reason: 'network', message };
    }
    return { ok: false, reason: 'error', message };
  }
}

async function replaceOpenOrderItemsWithFreshRevision(
  orderId: string,
  items: CartItem[],
  delivery: {
    name: string;
    mobile: string;
    address: string;
    pincode: string;
    addressId: string;
  },
  hintRevision?: number | null,
): Promise<Order> {
  const fresh = await getMyOrderById(orderId);
  const revision = fresh?.items_revision ?? hintRevision ?? undefined;
  try {
    return await replaceOpenOrderItems(orderId, items, delivery, revision);
  } catch (placeError) {
    const message = placeError instanceof Error ? placeError.message : '';
    if (!/ORDER_STALE/i.test(message)) {
      throw placeError;
    }
    const again = await getMyOrderById(orderId);
    const retryRevision = again?.items_revision;
    if (retryRevision == null || retryRevision === revision) {
      throw placeError;
    }
    return replaceOpenOrderItems(orderId, items, delivery, retryRevision);
  }
}
