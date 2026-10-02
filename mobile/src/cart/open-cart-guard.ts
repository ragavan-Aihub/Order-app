import {
  formatAddressForOrder,
  getSelectedAddress,
  loadAddressBook,
  type SavedAddress,
} from '@/cart/address-book';
import {
  findOpenOrderForAddress,
  getLatestUndeliveredOrderForAddress,
  listMyUndeliveredOrders,
  matchOrderToAddress,
} from '@/services/orders';
import type { Order } from '@/types/order';
import { isOpenOrderStatus } from '@/types/order';
import { formatOrderNumber, formatOrderStatus } from '@/utils/format';

export function openOrderCartMessage(order: Order) {
  return `You already have order #${formatOrderNumber(order.order_number)} for this address. Modify that order, or pick another address.`;
}

export async function findOpenOrderForSelectedAddress(reload = true): Promise<Order | null> {
  if (reload) {
    await loadAddressBook().catch(() => undefined);
  }
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

export type AddressNewOrderRow = {
  address: SavedAddress;
  blockingOrder: Order | null;
  activeOrder?: Order | null;
};

export async function newOrderEligibilityForAddresses(addresses: SavedAddress[]): Promise<AddressNewOrderRow[]> {
  const active = await listMyUndeliveredOrders();
  const opens = active.filter((order) => isOpenOrderStatus(order.status));
  return addresses.map((address) => {
    const details = {
      addressId: address.id,
      address: formatAddressForOrder(address),
      pincode: address.pincode,
    };
    return {
      address,
      blockingOrder: matchOrderToAddress(opens, details, false),
      activeOrder: matchOrderToAddress(active, details, false),
    };
  });
}

export async function findLatestOrderForAddress(details: {
  addressId?: string;
  address?: string;
  pincode?: string;
}): Promise<Order | null> {
  return getLatestUndeliveredOrderForAddress(details);
}

export function lockedOrderMessage(order: Order) {
  return `Order #${formatOrderNumber(order.order_number)} is ${formatOrderStatus(order.status)} and cannot be changed. I can start those items as a new order at an eligible address.`;
}

export function canModifyExistingOrder(order: Order | null) {
  return Boolean(order && isOpenOrderStatus(order.status));
}
