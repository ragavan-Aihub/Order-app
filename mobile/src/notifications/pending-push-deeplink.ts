import AsyncStorage from '@react-native-async-storage/async-storage';
import type * as Notifications from 'expo-notifications';

import { homeParamsForAvailableProductPush } from '@/notifications/product-available-push-route';
import { getPushNavigationTarget } from '@/notifications/order-push';
import { isPushAvailable } from '@/notifications/push-runtime';

const HANDLED_LAUNCH_RESPONSE_KEY = '@push/handled_launch_response_id';

export type PendingPushLaunch = {
  responseId: string;
  target: NonNullable<ReturnType<typeof getPushNavigationTarget>>;
};

let pendingLaunch: PendingPushLaunch | null = null;
let capturePromise: Promise<PendingPushLaunch | null> | null = null;

function responseId(response: Notifications.NotificationResponse): string {
  return response.notification.request.identifier;
}

/** Read cold-start notification once; safe to call from root layout and index in parallel. */
export function captureNotificationLaunchTarget(): Promise<PendingPushLaunch | null> {
  if (!isPushAvailable()) {
    return Promise.resolve(null);
  }
  if (!capturePromise) {
    capturePromise = (async () => {
      const Notifications = await import('expo-notifications');
      const response = await Notifications.getLastNotificationResponseAsync();
      if (!response) {
        return null;
      }
      const id = responseId(response);
      const handled = await AsyncStorage.getItem(HANDLED_LAUNCH_RESPONSE_KEY);
      if (handled === id) {
        return null;
      }
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      const target = getPushNavigationTarget(data);
      if (!target) {
        return null;
      }
      pendingLaunch = { responseId: id, target };
      return pendingLaunch;
    })().catch(() => null);
  }
  return capturePromise;
}

export function peekPendingPushLaunch(): PendingPushLaunch | null {
  return pendingLaunch;
}

/** Take pending launch target so only one navigator (index or push hook) handles it. */
export function takePendingPushLaunch(): PendingPushLaunch | null {
  const next = pendingLaunch;
  pendingLaunch = null;
  return next;
}

export async function markPushLaunchHandled(responseId: string): Promise<void> {
  await AsyncStorage.setItem(HANDLED_LAUNCH_RESPONSE_KEY, responseId);
  if (pendingLaunch?.responseId === responseId) {
    pendingLaunch = null;
  }
}

export function routeForPushLaunch(
  launch: PendingPushLaunch,
):
  | {
      pathname: '/home';
      params: ReturnType<typeof homeParamsForAvailableProductPush>;
    }
  | { pathname: '/order/[id]'; params: { id: string } } {
  if (launch.target.kind === 'product') {
    return {
      pathname: '/home',
      params: homeParamsForAvailableProductPush(launch.target.productId),
    };
  }
  return { pathname: '/order/[id]', params: { id: launch.target.orderId } };
}
