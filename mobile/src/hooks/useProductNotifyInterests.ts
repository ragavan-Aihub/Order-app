import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { productNotifyCopy } from '@/copy/product-notify';
import { useNetworkStatus } from '@/network/NetworkProvider';
import { ensurePushForProductNotify } from '@/notifications/ensure-push-permission';
import { registerForOrderPush } from '@/notifications/order-push';
import {
  fetchMyProductNotifyIds,
  removeProductNotifyInterest,
  upsertProductNotifyInterest,
} from '@/services/product-notify';
import { getSignedInUser } from '@/services/supabase';

export function useProductNotifyInterests() {
  const router = useRouter();
  const { requireConnection } = useNetworkStatus();
  const [notifiedIds, setNotifiedIds] = useState<Set<string>>(() => new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const ids = await fetchMyProductNotifyIds();
    setNotifiedIds(new Set(ids));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const isNotified = useCallback((productId: string) => notifiedIds.has(productId), [notifiedIds]);

  const onNotifyPress = useCallback(
    async (productId: string, productName: string) => {
      if (busyId) {
        return;
      }
      if (notifiedIds.has(productId)) {
        Alert.alert(productNotifyCopy.stopTitle, productNotifyCopy.stopBody(productName), [
          { text: productNotifyCopy.stopCancel, style: 'cancel' },
          {
            text: productNotifyCopy.stopConfirm,
            style: 'destructive',
            onPress: () => {
              void (async () => {
                if (!(await requireConnection())) {
                  return;
                }
                setBusyId(productId);
                const result = await removeProductNotifyInterest(productId);
                setBusyId(null);
                if (!result.ok) {
                  Alert.alert(productNotifyCopy.errorGeneric);
                  return;
                }
                setNotifiedIds((prev) => {
                  const next = new Set(prev);
                  next.delete(productId);
                  return next;
                });
              })();
            },
          },
        ]);
        return;
      }

      if (!(await requireConnection())) {
        return;
      }
      const user = await getSignedInUser();
      if (!user) {
        router.push({ pathname: '/login', params: { next: 'home' } });
        return;
      }

      setBusyId(productId);
      const result = await upsertProductNotifyInterest(productId);
      if (!result.ok) {
        setBusyId(null);
        Alert.alert(productNotifyCopy.errorGeneric);
        return;
      }
      setNotifiedIds((prev) => new Set(prev).add(productId));
      const permission = await ensurePushForProductNotify();
      if (permission === 'granted') {
        void registerForOrderPush();
      }
      setBusyId(null);
    },
    [busyId, notifiedIds, requireConnection, router],
  );

  return { isNotified, busyId, onNotifyPress, refresh };
}
