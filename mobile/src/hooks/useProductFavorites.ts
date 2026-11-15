import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { showAppDialog } from '@/components/AppDialogHost';
import { useNetworkStatus } from '@/network/NetworkProvider';
import {
  fetchMyFavoriteIds,
  rememberPendingFavorite,
  takePendingFavorite,
  toggleProductFavorite,
} from '@/services/favorites';
import { getSignedInUser } from '@/services/supabase';

export function useProductFavorites() {
  const router = useRouter();
  const { requireConnection } = useNetworkStatus();
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const user = await getSignedInUser();
    if (!user) {
      setFavoriteIds([]);
      return;
    }
    const pending = await takePendingFavorite();
    if (pending) {
      await toggleProductFavorite(pending);
    }
    setFavoriteIds(await fetchMyFavoriteIds());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
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
        }
      } finally {
        setBusyId(null);
      }
    },
    [busyId, favoriteIds, requireConnection, router],
  );

  return { favoriteIds, isFavorite, favoriteBusyId: busyId, onFavoritePress, refreshFavorites: refresh };
}
