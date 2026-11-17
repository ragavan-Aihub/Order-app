import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { showAppDialog } from '@/components/AppDialogHost';
import { useNetworkStatus } from '@/network/NetworkProvider';
import {
  fetchMyFavoriteIds,
  rememberPendingFavorite,
  takePendingFavorite,
  toggleProductFavorite,
} from '@/services/favorites';
import { getSignedInUser } from '@/services/supabase';

const FAVORITES_FOCUS_TTL_MS = 30_000;

export function useProductFavorites() {
  const router = useRouter();
  const { requireConnection } = useNetworkStatus();
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const loadedOnce = useRef(false);
  const lastRefreshAt = useRef(0);

  const refresh = useCallback(async (force = false) => {
    if (!force && loadedOnce.current && Date.now() - lastRefreshAt.current < FAVORITES_FOCUS_TTL_MS) {
      return;
    }
    const user = await getSignedInUser();
    if (!user) {
      setFavoriteIds([]);
      loadedOnce.current = true;
      lastRefreshAt.current = Date.now();
      return;
    }
    const pending = await takePendingFavorite();
    if (pending) {
      await toggleProductFavorite(pending);
    }
    setFavoriteIds(await fetchMyFavoriteIds());
    loadedOnce.current = true;
    lastRefreshAt.current = Date.now();
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh(false);
    }, [refresh]),
  );

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

  return { favoriteIds, isFavorite, favoriteBusyId: busyId, onFavoritePress, refreshFavorites: refresh };
}
