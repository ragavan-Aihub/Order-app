import { Alert } from 'react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { loadCart, loadEditingOrderId, saveCart, saveEditingOrderId } from '@/cart/cart-storage';
import {
  CART_LIMIT_ITEMS,
  CART_LIMIT_QTY,
  MAX_CART_ITEMS,
  MAX_ITEM_QTY,
} from '@/cart/limits';
import { findOpenOrderForSelectedAddress } from '@/cart/open-cart-guard';
import { getSelectedAddress, subscribeAddressBook } from '@/cart/address-book';
import type { Order } from '@/types/order';
import type { Product } from '@/types/product';

export type CartItem = {
  product: Product;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  totalAmount: number;
  editingOrderId: string | null;
  openOrder: Order | null;
  openOrderBlock: Order | null;
  addItem: (product: Product, quantity?: number) => boolean;
  increase: (productId: string) => void;
  decrease: (productId: string) => void;
  remove: (productId: string) => void;
  replaceItems: (next: CartItem[]) => void;
  clearCart: () => void;
  beginEditOrder: (orderId: string, next: CartItem[]) => void;
  markOrderSaved: (next: CartItem[]) => void;
  clearEditOrder: () => void;
  forgetOpenOrder: (orderId: string) => void;
  refreshOpenOrder: () => void;
  resumeEdit: boolean;
  takeResumeEdit: () => void;
  hasOrderChanges: boolean;
};

const CartContext = createContext<CartContextValue | null>(null);

function clampCart(items: CartItem[]) {
  return items
    .filter((item) => item.product.available !== false && item.quantity > 0)
    .slice(0, MAX_CART_ITEMS)
    .map((item) => ({
      ...item,
      quantity: Math.min(MAX_ITEM_QTY, Math.max(1, Math.floor(item.quantity))),
    }));
}

function cartFingerprint(items: CartItem[]) {
  return clampCart(items)
    .map((item) => `${item.product.id}:${item.quantity}`)
    .sort()
    .join('|');
}

function notifyLimit(kind: 'items' | 'qty') {
  Alert.alert('Order limit', kind === 'items' ? CART_LIMIT_ITEMS : CART_LIMIT_QTY);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [openOrder, setOpenOrder] = useState<Order | null>(null);
  const [ready, setReady] = useState(false);
  const [savedFingerprint, setSavedFingerprint] = useState<string | null>(null);
  const [openOrderReady, setOpenOrderReady] = useState(false);
  const [openOrderCheck, setOpenOrderCheck] = useState(0);
  const [resumeEdit, setResumeEdit] = useState(false);
  const takeResumeEdit = useCallback(() => setResumeEdit(false), []);
  const refreshOpenOrder = useCallback(() => setOpenOrderCheck((count) => count + 1), []);

  const beginEditOrder = useCallback((orderId: string, next: CartItem[]) => {
    const clamped = clampCart(next);
    setOpenOrderReady(false);
    const fingerprint = cartFingerprint(clamped);
    setEditingOrderId(orderId);
    setItems(clamped);
    setSavedFingerprint(fingerprint);
    saveEditingOrderId(orderId, fingerprint).catch(() => undefined);
  }, []);

  const clearCart = useCallback(() => {
    setEditingOrderId(null);
    setItems([]);
    setSavedFingerprint(null);
    saveEditingOrderId(null).catch(() => undefined);
  }, []);

  const markOrderSaved = useCallback((next: CartItem[]) => {
    const clamped = clampCart(next);
    setItems(clamped);
    setSavedFingerprint(cartFingerprint(clamped));
  }, []);

  useEffect(() => {
    Promise.all([loadCart(), loadEditingOrderId()])
      .then(([stored, edit]) => {
        const restored = clampCart(stored);
        const changed = Boolean(
          edit?.fingerprint && restored.length && cartFingerprint(restored) !== edit.fingerprint,
        );
        if (edit && changed) {
          setItems(restored);
          setEditingOrderId(edit.orderId);
          setSavedFingerprint(edit.fingerprint);
          setResumeEdit(true);
          return;
        }
        if (edit) {
          setItems([]);
          saveEditingOrderId(null).catch(() => undefined);
          return;
        }
        setItems(restored);
      })
      .catch(() => setItems([]))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setOpenOrderReady(false);
    const refresh = (reload: boolean) => {
      findOpenOrderForSelectedAddress(reload)
        .then((open) => {
          if (!cancelled) {
            setOpenOrder((current) => {
              if (editingOrderId && current?.id === editingOrderId) {
                return current;
              }
              if (
                current &&
                open &&
                current.id === open.id &&
                current.status === open.status &&
                current.total_amount === open.total_amount &&
                current.customer_address_id === open.customer_address_id &&
                current.update_count === open.update_count
              ) {
                return current;
              }
              return open;
            });
            setOpenOrderReady(true);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setOpenOrder(null);
            setOpenOrderReady(true);
          }
        });
    };
    refresh(openOrderCheck === 0 || !getSelectedAddress());
    const unsubscribe = subscribeAddressBook(() => refresh(false));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [editingOrderId, openOrderCheck]);

  useEffect(() => {
    if (!openOrderReady || !editingOrderId) {
      return;
    }
    if (!openOrder || editingOrderId === openOrder.id) {
      return;
    }
    setEditingOrderId(null);
    setSavedFingerprint(null);
    saveEditingOrderId(null).catch(() => undefined);
    setItems([]);
  }, [editingOrderId, openOrder, openOrderReady]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    saveCart(items).catch(() => undefined);
  }, [items, ready]);

  const value = useMemo<CartContextValue>(() => {
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const editing = Boolean(openOrder && editingOrderId === openOrder.id);

    return {
      items,
      itemCount,
      totalAmount,
      editingOrderId,
      openOrder,
      openOrderBlock: editing ? null : openOrder,
      hasOrderChanges: Boolean(
        editing &&
          savedFingerprint !== null &&
          items.length > 0 &&
          cartFingerprint(items) !== savedFingerprint,
      ),
      addItem(product, quantity = 1) {
        if (product.available === false) {
          return false;
        }
        const add = Math.max(1, Math.floor(quantity));
        setItems((current) => {
          const existing = current.find((item) => item.product.id === product.id);
          if (existing) {
            if (existing.quantity >= MAX_ITEM_QTY) {
              notifyLimit('qty');
              return current;
            }
            const nextQty = Math.min(MAX_ITEM_QTY, existing.quantity + add);
            if (existing.quantity + add > MAX_ITEM_QTY) {
              notifyLimit('qty');
            }
            return current.map((item) =>
              item.product.id === product.id ? { ...item, quantity: nextQty } : item,
            );
          }
          if (current.length >= MAX_CART_ITEMS) {
            notifyLimit('items');
            return current;
          }
          if (add > MAX_ITEM_QTY) {
            notifyLimit('qty');
          }
          return [...current, { product, quantity: Math.min(MAX_ITEM_QTY, add) }];
        });
        return true;
      },
      increase(productId) {
        setItems((current) => {
          const existing = current.find((item) => item.product.id === productId);
          if (!existing) {
            return current;
          }
          if (existing.quantity >= MAX_ITEM_QTY) {
            notifyLimit('qty');
            return current;
          }
          return current.map((item) =>
            item.product.id === productId ? { ...item, quantity: item.quantity + 1 } : item,
          );
        });
      },
      decrease(productId) {
        setItems((current) =>
          current
            .map((item) =>
              item.product.id === productId ? { ...item, quantity: item.quantity - 1 } : item,
            )
            .filter((item) => item.quantity > 0),
        );
      },
      remove(productId) {
        setItems((current) => current.filter((item) => item.product.id !== productId));
      },
      replaceItems(next) {
        const usable = next.filter((item) => item.product.available !== false && item.quantity > 0);
        if (usable.length > MAX_CART_ITEMS) {
          notifyLimit('items');
        } else if (usable.some((item) => item.quantity > MAX_ITEM_QTY)) {
          notifyLimit('qty');
        }
        setItems(clampCart(next));
      },
      clearCart,
      beginEditOrder,
      markOrderSaved,
      refreshOpenOrder,
      resumeEdit,
      takeResumeEdit,
      clearEditOrder() {
        setEditingOrderId(null);
        setSavedFingerprint(null);
        saveEditingOrderId(null).catch(() => undefined);
      },
      forgetOpenOrder(orderId: string) {
        setOpenOrder((current) => (current?.id === orderId ? null : current));
        setEditingOrderId((current) => (current === orderId ? null : current));
        setItems((current) => (editingOrderId === orderId ? [] : current));
        if (editingOrderId === orderId) {
          setSavedFingerprint(null);
          saveEditingOrderId(null).catch(() => undefined);
        }
      },
    };
  }, [
    beginEditOrder,
    clearCart,
    editingOrderId,
    items,
    markOrderSaved,
    openOrder,
    refreshOpenOrder,
    resumeEdit,
    savedFingerprint,
    takeResumeEdit,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used inside CartProvider');
  }
  return context;
}
