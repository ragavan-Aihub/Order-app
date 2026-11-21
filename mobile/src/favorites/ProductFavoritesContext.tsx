import { useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

import { showAppDialog } from '@/components/AppDialogHost';
import { useNetworkStatus } from '@/network/NetworkProvider';
import {
  clearPendingFavoriteIf,
  ensureProductFavorite,
  fetchMyFavoriteIds,
  rememberPendingFavorite,
  takePendingFavorite,
  toggleProductFavorite,
} from '@/services/favorites';
import { getSignedInUser } from '@/services/supabase';

const FAVORITES_FOCUS_TTL_MS = 30_000;

type ProductFavoritesContextValue = {
  favoriteIds: string[];
  isFavorite: (productId: string) => boolean;
  favoriteBusyId: string | null;
  onFavoritePress: (productId: string) => Promise<void>;
  refreshFavorites: (force?: boolean) => Promise<void>;
};

const ProductFavoritesContext = createContext<ProductFavoritesContextValue | null>(null);

export function ProductFavoritesProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { requireConnection } = useNetworkStatus();
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const loadedOnce = useRef(false);
  const lastRefreshAt = useRef(0);

  const refresh = useCallback(async (force = false) => {
    const user = await getSignedInUser();
    if (!user) {
      setFavoriteIds([]);
      loadedOnce.current = true;
      lastRefreshAt.current = Date.now();
      return;
    }

    const pending = await takePendingFavorite();
    if (pending) {
      await ensureProductFavorite(pending);
    } else if (!force && loadedOnce.current && Date.now() - lastRefreshAt.current < FAVORITES_FOCUS_TTL_MS) {
      return;
    }

    setFavoriteIds(await fetchMyFavoriteIds());
    loadedOnce.current = true;
    lastRefreshAt.current = Date.now();
  }, []);

  const isFavorite = useCallback((productId: string) => favoriteIds.includes(productId), [favoriteIds]);

  const onFavoritePress = useCallback(
    async (productId: string) => {
      if (busyId) {
        return;
      }
      if (!(await requireConnection())) {
        return;
      }
      const user = await getSignedInUser();
      if (!user) {
        await rememberPendingFavorite(productId);
        router.push({ pathname: '/login', params: { next: 'home' } });
        return;
      }
      setBusyId(productId);
      const wasOn = favoriteIds.includes(productId);
      if (wasOn) {
        await clearPendingFavoriteIf(productId);
      }
      setFavoriteIds((current) =>
        wasOn ? current.filter((id) => id !== productId) : [productId, ...current.filter((id) => id !== productId)],
      );
      try {
        const result = await toggleProductFavorite(productId);
        if (!result.ok) {
          setFavoriteIds((current) =>
            wasOn ? [productId, ...current.filter((id) => id !== productId)] : current.filter((id) => id !== productId),
          );
          showAppDialog({
            title: 'Could not save this favourite.',
            icon: 'cloud-offline',
            tone: 'warning',
          });
        } else {
          lastRefreshAt.current = Date.now();
        }
      } finally {
        setBusyId(null);
      }
    },
    [busyId, favoriteIds, requireConnection, router],
  );

  const value = useMemo(
    () => ({
      favoriteIds,
      isFavorite,
      favoriteBusyId: busyId,
      onFavoritePress,
      refreshFavorites: refresh,
    }),
    [busyId, favoriteIds, isFavorite, onFavoritePress, refresh],
  );

  return <ProductFavoritesContext.Provider value={value}>{children}</ProductFavoritesContext.Provider>;
}

export function useProductFavoritesContext() {
  const value = useContext(ProductFavoritesContext);
  if (!value) {
    throw new Error('useProductFavorites must be used within ProductFavoritesProvider.');
  }
  return value;
}