import { useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  captureNotificationLaunchTarget,
  markPushLaunchHandled,
  routeForPushLaunch,
  takePendingPushLaunch,
} from '@/notifications/pending-push-deeplink';
import { homeParamsForAvailableProductPush } from '@/notifications/product-available-push-route';
import { isPushAvailable } from '@/notifications/push-runtime';
import { invalidateProductCatalogCache } from '@/services/products';
import { getSupabaseClient } from '@/services/supabase';

let handlerConfigured = false;

/** Call once inside the signed-in shop shell. No-op in Expo Go. */
export function useOrderPushRegistration() {
  const router = useRouter();

  const pushHandlers = useCallback(
    () => ({
      onOpenOrder: (orderId: string) => {
        router.replace({ pathname: '/order/[id]', params: { id: orderId } });
      },
      onOpenProduct: (productId: string) => {
        invalidateProductCatalogCache();
        router.replace({
          pathname: '/home',
          params: homeParamsForAvailableProductPush(productId),
        });
      },
    }),
    [router],
  );

  useEffect(() => {
    if (!isPushAvailable()) {
      return;
    }

    let subscription: { remove: () => void } | undefined;
    let active = true;
    let authSubscription: { unsubscribe: () => void } | undefined;

    const handlers = pushHandlers();

    const tryRegister = async () => {
      const push = await import('@/notifications/order-push');
      if (!active) {
        return;
      }
      const result = await push.registerForOrderPush();
      if (__DEV__ && !result.ok && result.reason !== 'no_session' && result.reason !== 'permission_denied') {
        console.warn('[push] register', result);
      }
    };

    (async () => {
      const push = await import('@/notifications/order-push');
      if (!active) {
        return;
      }
      if (!handlerConfigured) {
        push.configureOrderNotificationHandler();
        handlerConfigured = true;
      }

      const Notifications = await import('expo-notifications');
      subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        push.handlePushNotificationResponse(response, handlers);
        void markPushLaunchHandled(response.notification.request.identifier);
      });

      await captureNotificationLaunchTarget();
      if (active) {
        const launch = takePendingPushLaunch();
        if (launch) {
          router.replace(routeForPushLaunch(launch));
          await markPushLaunchHandled(launch.responseId);
        }
      }

      await tryRegister();
    })().catch((error) => {
      if (__DEV__) {
        console.warn('[push] setup failed', error);
      }
    });

    const supabase = getSupabaseClient();
    if (supabase) {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (!active || !session?.user) {
          return;
        }
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          void tryRegister();
        }
      });
      authSubscription = data.subscription;
    }

    const onAppState = (next: AppStateStatus) => {
      if (next === 'active' && active) {
        void tryRegister();
      }
    };
    const appSub = AppState.addEventListener('change', onAppState);

    return () => {
      active = false;
      subscription?.remove();
      authSubscription?.unsubscribe();
      appSub.remove();
    };
  }, [pushHandlers]);
}
