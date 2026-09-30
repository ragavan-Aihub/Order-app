import { Alert } from 'react-native';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { loadCart, saveCart } from '@/cart/cart-storage';
import {
  CART_LIMIT_ITEMS,
  CART_LIMIT_QTY,
  MAX_CART_ITEMS,
  MAX_ITEM_QTY,
} from '@/cart/limits';
import type { Product } from '@/types/product';

export type CartItem = {
  product: Product;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  totalAmount: number;
  addItem: (product: Product, quantity?: number) => void;
  increase: (productId: string) => void;
  decrease: (productId: string) => void;
  remove: (productId: string) => void;
  replaceItems: (next: CartItem[]) => void;
  clearCart: () => void;
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

function notifyLimit(kind: 'items' | 'qty') {
  Alert.alert('Order limit', kind === 'items' ? CART_LIMIT_ITEMS : CART_LIMIT_QTY);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadCart()
      .then((stored) => setItems(clampCart(stored)))
      .catch(() => setItems([]))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }
    saveCart(items).catch(() => undefined);
  }, [items, ready]);

  const value = useMemo<CartContextValue>(() => {
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

    return {
      items,
      itemCount,
      totalAmount,
      addItem(product, quantity = 1) {
        if (product.available === false) {
          return;
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
      clearCart() {
        setItems([]);
      },
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used inside CartProvider');
  }
  return context;
}
