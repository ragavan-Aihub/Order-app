import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { getBusiness } from '@/services/business';
import { getShopCategories } from '@/services/categories';
import type { ShopCategory } from '@/types/category';

type ShopCatalogValue = {
  categoriesEnabled: boolean;
  categories: ShopCategory[];
  ready: boolean;
  refreshCatalog: () => Promise<void>;
};

const ShopCatalogContext = createContext<ShopCatalogValue | null>(null);

export function ShopCatalogProvider({ children }: { children: ReactNode }) {
  const [categoriesEnabled, setCategoriesEnabled] = useState(false);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [ready, setReady] = useState(false);

  const refreshCatalog = useCallback(async () => {
    try {
      const [business, rows] = await Promise.all([getBusiness(), getShopCategories()]);
      const flaggedOff = business?.categories_enabled === false;
      const enabled = !flaggedOff && (Boolean(business?.categories_enabled) || rows.length > 0);
      setCategoriesEnabled(enabled);
      setCategories(enabled ? rows : []);
    } catch {
      setCategoriesEnabled(false);
      setCategories([]);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  const value = useMemo(
    () => ({ categoriesEnabled, categories, ready, refreshCatalog }),
    [categories, categoriesEnabled, ready, refreshCatalog],
  );

  return <ShopCatalogContext.Provider value={value}>{children}</ShopCatalogContext.Provider>;
}

export function useShopCatalog(): ShopCatalogValue {
  const value = useContext(ShopCatalogContext);
  if (!value) {
    return { categoriesEnabled: false, categories: [], ready: true, refreshCatalog: async () => undefined };
  }
  return value;
}
