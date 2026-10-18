import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { isPushAvailable } from '@/notifications/push-runtime';
import { getSupabaseClient } from '@/services/supabase';

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
    let authSubscription: { unsubscribe: () => void } | undefined;

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

      subscription = push.addOrderNotificationResponseListener((orderId) => {
        router.push({ pathname: '/order/[id]', params: { id: orderId } });
      });

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
  }, [router]);
}
