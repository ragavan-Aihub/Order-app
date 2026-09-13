import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { loadCart, saveCart } from '@/cart/cart-storage';
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
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadCart()
      .then(setItems)
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
        setItems((current) => {
          const existing = current.find((item) => item.product.id === product.id);
          if (existing) {
            return current.map((item) =>
              item.product.id === product.id
                ? { ...item, quantity: item.quantity + quantity }
                : item,
            );
          }
          return [...current, { product, quantity }];
        });
      },
      increase(productId) {
        setItems((current) =>
          current.map((item) =>
            item.product.id === productId ? { ...item, quantity: item.quantity + 1 } : item,
          ),
        );
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
