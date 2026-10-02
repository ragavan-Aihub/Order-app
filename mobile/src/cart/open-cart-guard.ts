import {
  formatAddressForOrder,
  getSelectedAddress,
  loadAddressBook,
} from '@/cart/address-book';
import { findOpenOrderForAddress } from '@/services/orders';
import type { Order } from '@/types/order';
import { formatOrderNumber } from '@/utils/format';

export function openOrderCartMessage(order: Order) {
  return `You already have order #${formatOrderNumber(order.order_number)} for this address. Modify that order, or pick another address.`;
}

export async function findOpenOrderForSelectedAddress(): Promise<Order | null> {
  await loadAddressBook().catch(() => undefined);
  const selected = getSelectedAddress();
  if (!selected) {
    return null;
  }
  return findOpenOrderForAddress({
    addressId: selected.id,
    address: formatAddressForOrder(selected),
    pincode: selected.pincode,
  });
}

export async function findOpenOrderBlockingNewCart(editingOrderId?: string | null): Promise<Order | null> {
  const open = await findOpenOrderForSelectedAddress();
  if (!open || open.id === editingOrderId) {
    return null;
  }
  return open;
}
