import type { CartItem } from '@/cart/CartContext';
import { formatAddressForOrder, type SavedAddress } from '@/cart/address-book';
import { isNetworkFailure } from '@/services/network';
import { placeOrder } from '@/services/orders';
import { getAvailableProducts } from '@/services/products';
import { getSignedInUser } from '@/services/supabase';
import type { Order } from '@/types/order';

export type SubmitOrderResult =
  | { ok: true; order: Order }
  | { ok: false; reason: 'empty' | 'address' | 'auth' | 'unavailable' | 'network' | 'error'; message: string };

export async function submitShopOrder(
  items: CartItem[],
  selected: SavedAddress | null,
): Promise<SubmitOrderResult> {
  if (items.length === 0) {
    return { ok: false, reason: 'empty', message: 'Your cart is empty.' };
  }
  if (!selected) {
    return { ok: false, reason: 'address', message: 'Add a delivery address.' };
  }
  const user = await getSignedInUser();
  if (!user) {
    return { ok: false, reason: 'auth', message: 'Sign in to place your order.' };
  }
  const catalog = await getAvailableProducts();
  const blocked = items.find((item) => {
    const live = catalog.find((product) => product.id === item.product.id);
    return !live || live.available === false || live.active === false;
  });
  if (blocked) {
    return {
      ok: false,
      reason: 'unavailable',
      message: `${blocked.product.name} is coming soon or no longer sold. Remove it from the cart.`,
    };
  }
  try {
    const order = await placeOrder(
      {
        name: selected.name,
        mobile: selected.mobile,
        address: formatAddressForOrder(selected),
        pincode: selected.pincode,
        addressId: selected.id,
      },
      items,
    );
    return { ok: true, order };
  } catch (placeError) {
    const message = placeError instanceof Error ? placeError.message : 'Could not place the order.';
    if (message.toLowerCase().includes('sign in')) {
      return { ok: false, reason: 'auth', message };
    }
    if (isNetworkFailure(placeError) || isNetworkFailure(message)) {
      return { ok: false, reason: 'network', message };
    }
    return { ok: false, reason: 'error', message };
  }
}
