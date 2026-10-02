import type { CartItem } from '@/cart/CartContext';
import { formatAddressForOrder, type SavedAddress } from '@/cart/address-book';
import { isNetworkFailure } from '@/services/network';
import {
  findOpenOrderForAddress,
  placeOrder,
  replaceOpenOrderItems,
} from '@/services/orders';
import { getSignedInUser } from '@/services/supabase';
import type { Order } from '@/types/order';

export type SubmitOrderResult =
  | { ok: true; order: Order }
  | {
      ok: false;
      reason: 'empty' | 'address' | 'auth' | 'unavailable' | 'network' | 'error' | 'open_order';
      message: string;
      openOrder?: Order;
    };

export async function submitShopOrder(
  items: CartItem[],
  selected: SavedAddress | null,
  editingOrderId?: string | null,
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
      const order = await replaceOpenOrderItems(editingOrderId, items, details);
      return { ok: true, order };
    }

    const user = await getSignedInUser();
    if (!user) {
      return { ok: false, reason: 'auth', message: 'Sign in to place your order.' };
    }

    const order = await placeOrder(details, items);
    return { ok: true, order };
  } catch (placeError) {
    const message = placeError instanceof Error ? placeError.message : 'Could not place the order.';
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
