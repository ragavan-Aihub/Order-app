import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { isPushAvailable } from '@/notifications/push-runtime';
import { getSignedInUser } from '@/services/supabase';

let handlerConfigured = false;

/** Call once inside the signed-in shop shell. No-op in Expo Go. */
export function useOrderPushRegistration() {
  const router = useRouter();

  useEffect(() => {
    if (!isPushAvailable()) {
      return;
    }

    let subscription: { remove: () => void } | undefined;
    let active = true;

    (async () => {
      const push = await import('@/notifications/order-push');
      if (!active) {
        return;
      }
      if (!handlerConfigured) {
        push.configureOrderNotificationHandler();
        handlerConfigured = true;
      }

      subscription = push.addOrderNotificationResponseListener((orderId) => {
        router.push({ pathname: '/order/[id]', params: { id: orderId } });
      });

      const user = await getSignedInUser();
      if (!active || !user) {
        return;
      }
      await push.registerForOrderPush();
    })().catch(() => undefined);

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [router]);
}
