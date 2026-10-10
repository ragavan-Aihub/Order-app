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
import { getMyOrderById } from '@/services/orders';
import type { Order } from '@/types/order';
import type { Product } from '@/types/product';

export type CartItem = {
  product: Product;
  quantity: number;
};

export type RowChange = { kind: 'new' } | { kind: 'changed'; from: number } | null;

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  totalAmount: number;
  editingOrderId: string | null;
  editingItemsRevision: number | null;
  openOrder: Order | null;
  openOrderBlock: Order | null;
  openOrderReady: boolean;
  addItem: (product: Product, quantity?: number) => boolean;
  increase: (productId: string) => void;
  decrease: (productId: string) => void;
  remove: (productId: string) => void;
  replaceItems: (next: CartItem[]) => void;
  clearCart: () => void;
  beginEditOrder: (orderId: string, next: CartItem[], order?: Order) => void;
  markOrderSaved: (next: CartItem[]) => void;
  clearEditOrder: () => void;
  syncEditingItemsRevision: (revision: number) => void;
  forgetOpenOrder: (orderId: string) => void;
  refreshOpenOrder: () => void;
  resumeEdit: boolean;
  takeResumeEdit: () => void;
  hasOrderChanges: boolean;
  canRevertEdit: boolean;
  revertEditChanges: () => boolean;
  rowChange: (productId: string) => RowChange;
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
  const [editingItemsRevision, setEditingItemsRevision] = useState<number | null>(null);
  const [openOrder, setOpenOrder] = useState<Order | null>(null);
  const [ready, setReady] = useState(false);
  const [savedFingerprint, setSavedFingerprint] = useState<string | null>(null);
  const [originalItems, setOriginalItems] = useState<CartItem[] | null>(null);
  const [openOrderReady, setOpenOrderReady] = useState(false);
  const [openOrderCheck, setOpenOrderCheck] = useState(0);
  const [resumeEdit, setResumeEdit] = useState(false);
  const takeResumeEdit = useCallback(() => setResumeEdit(false), []);
  const refreshOpenOrder = useCallback(() => setOpenOrderCheck((count) => count + 1), []);

  const beginEditOrder = useCallback((orderId: string, next: CartItem[], order?: Order) => {
    const clamped = clampCart(next);
    setOpenOrderReady(false);
    if (order?.id === orderId) {
      setOpenOrder(order);
    }
    setEditingOrderId(orderId);
    setEditingItemsRevision(order?.items_revision ?? 0);
    setItems(clamped);
    setSavedFingerprint(cartFingerprint(clamped));
    setOriginalItems(clamped);
    void getMyOrderById(orderId)
      .then((fresh) => {
        if (fresh?.items_revision != null) {
          setEditingItemsRevision(fresh.items_revision);
        }
      })
      .catch(() => undefined);
  }, []);

  const clearCart = useCallback(() => {
    setEditingOrderId(null);
    setEditingItemsRevision(null);
    setItems([]);
    setSavedFingerprint(null);
    setOriginalItems(null);
  }, []);

  const markOrderSaved = useCallback((next: CartItem[]) => {
    const clamped = clampCart(next);
    setItems(clamped);
    setSavedFingerprint(cartFingerprint(clamped));
    setOriginalItems(clamped);
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
          setEditingItemsRevision(edit.itemsRevision ?? null);
          setSavedFingerprint(edit.fingerprint);
          setOriginalItems(edit.items ? clampCart(edit.items) : null);
          setResumeEdit(true);
          void getMyOrderById(edit.orderId)
            .then((fresh) => {
              if (fresh?.items_revision != null) {
                setEditingItemsRevision(fresh.items_revision);
              }
            })
            .catch(() => undefined);
          return;
        }
        if (edit) {
          setItems([]);
          Promise.all([saveCart([]), saveEditingOrderId(null)]).catch(() => undefined);
          return;
        }
        setItems(restored);
      })
      .catch(() => setItems([]))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }
    saveEditingOrderId(
      editingOrderId,
      savedFingerprint,
      editingOrderId ? originalItems : null,
      editingOrderId ? editingItemsRevision : null,
    ).catch(() => undefined);
  }, [editingItemsRevision, editingOrderId, originalItems, ready, savedFingerprint]);

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
                current.update_count === open.update_count &&
                (current.items_revision ?? 0) === (open.items_revision ?? 0)
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
    const unsubscribe = subscribeAddressBook(() => {
      setOpenOrderReady(false);
      refresh(false);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [editingOrderId, openOrderCheck]);

  useEffect(() => {
    if (editingOrderId && editingItemsRevision === null && openOrder?.id === editingOrderId) {
      setEditingItemsRevision(openOrder.items_revision ?? 0);
    }
  }, [editingItemsRevision, editingOrderId, openOrder]);

  useEffect(() => {
    if (!openOrderReady || !editingOrderId) {
      return;
    }
    if (!openOrder || editingOrderId === openOrder.id) {
      return;
    }
    setEditingOrderId(null);
    setSavedFingerprint(null);
    setOriginalItems(null);
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
    const originalQty = new Map((originalItems ?? []).map((item) => [item.product.id, item.quantity]));

    return {
      items,
      itemCount,
      totalAmount,
      editingOrderId,
      editingItemsRevision,
      openOrder,
      openOrderBlock: editing ? null : openOrder,
      openOrderReady,
      hasOrderChanges: Boolean(
        editing &&
          savedFingerprint !== null &&
          items.length > 0 &&
          cartFingerprint(items) !== savedFingerprint,
      ),
      canRevertEdit: Boolean(editing && originalItems?.length),
      revertEditChanges() {
        if (!editing || !originalItems?.length) {
          return false;
        }
        setItems(originalItems);
        return true;
      },
      rowChange(productId) {
        if (!editing || !originalItems) {
          return null;
        }
        const before = originalQty.get(productId);
        if (before === undefined) {
          return { kind: 'new' };
        }
        const now = items.find((item) => item.product.id === productId)?.quantity;
        return now !== undefined && now !== before ? { kind: 'changed', from: before } : null;
      },
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
        setEditingItemsRevision(null);
        setSavedFingerprint(null);
        setOriginalItems(null);
      },
      syncEditingItemsRevision(revision: number) {
        setEditingItemsRevision(revision);
      },
      forgetOpenOrder(orderId: string) {
        setOpenOrder((current) => (current?.id === orderId ? null : current));
        setEditingOrderId((current) => (current === orderId ? null : current));
        setItems((current) => (editingOrderId === orderId ? [] : current));
        if (editingOrderId === orderId) {
          setEditingItemsRevision(null);
          setSavedFingerprint(null);
          setOriginalItems(null);
        }
      },
    };
  }, [
    beginEditOrder,
    clearCart,
    editingOrderId,
    editingItemsRevision,
    items,
    markOrderSaved,
    openOrder,
    openOrderReady,
    originalItems,
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
