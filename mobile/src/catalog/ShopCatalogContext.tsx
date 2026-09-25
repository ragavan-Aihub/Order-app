import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { getBusiness } from '@/services/business';
import { getShopCategories } from '@/services/categories';
import type { ShopCategory } from '@/types/category';

type ShopCatalogValue = {
  categoriesEnabled: boolean;
  categories: ShopCategory[];
  ready: boolean;
};

const ShopCatalogContext = createContext<ShopCatalogValue | null>(null);

export function ShopCatalogProvider({ children }: { children: ReactNode }) {
  const [categoriesEnabled, setCategoriesEnabled] = useState(false);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([getBusiness(), getShopCategories()])
      .then(([business, rows]) => {
        if (!active) {
          return;
        }
        const enabled =
          business?.categories_enabled === false ? false : Boolean(business?.categories_enabled) || rows.length > 0;
        setCategoriesEnabled(enabled);
        setCategories(enabled ? rows : []);
      })
      .catch(() => {
        if (active) {
          setCategoriesEnabled(false);
          setCategories([]);
        }
      })
      .finally(() => {
        if (active) {
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({ categoriesEnabled, categories, ready }),
    [categories, categoriesEnabled, ready],
  );

  return <ShopCatalogContext.Provider value={value}>{children}</ShopCatalogContext.Provider>;
}

export function useShopCatalog(): ShopCatalogValue {
  const value = useContext(ShopCatalogContext);
  if (!value) {
    return { categoriesEnabled: false, categories: [], ready: true };
  }
  return value;
}
