import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getSupabaseClient } from '@/services/supabase';

const ANDROID_CHANNEL_ID = 'order-updates';

export function configureOrderNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') {
    return;
  }
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Order updates',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
}

export type RegisterPushResult =
  | { ok: true }
  | { ok: false; reason: 'simulator' | 'permission_denied' | 'no_project_id' | 'no_supabase' | 'no_session' | 'token' | 'save'; detail?: string };

/** Register this device for order status push (confirmation, out for delivery, delivered). */
export async function registerForOrderPush(): Promise<RegisterPushResult> {
  if (!Device.isDevice) {
    return { ok: false, reason: 'simulator' };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, reason: 'no_supabase' };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user) {
    return { ok: false, reason: 'no_session' };
  }

  await ensureAndroidChannel();

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    return { ok: false, reason: 'permission_denied' };
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.easProjectId;

  if (!projectId) {
    return { ok: false, reason: 'no_project_id' };
  }

  let pushToken: string;
  try {
    const push = await Notifications.getExpoPushTokenAsync({ projectId });
    pushToken = push.data;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (__DEV__) {
      console.warn('[push] getExpoPushTokenAsync', detail);
    }
    return { ok: false, reason: 'token', detail };
  }

  const platform =
    Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web'
      ? Platform.OS
      : 'unknown';

  const { error } = await supabase.rpc('upsert_push_token', {
    p_token: pushToken,
    p_platform: platform,
  });
  if (error) {
    if (__DEV__) {
      console.warn('[push] upsert_push_token', error.message);
    }
    return { ok: false, reason: 'save', detail: error.message };
  }

  return { ok: true };
}

function readId(data: Record<string, unknown> | undefined, ...keys: string[]): string | null {
  if (!data) {
    return null;
  }
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

export type PushNavigationTarget =
  | { kind: 'order'; orderId: string }
  | { kind: 'product'; productId: string };

export function getPushNavigationTarget(
  data: Record<string, unknown> | undefined,
): PushNavigationTarget | null {
  const orderId = readId(data, 'orderId', 'order_id');
  if (orderId) {
    return { kind: 'order', orderId };
  }
  const productId = readId(data, 'productId', 'product_id');
  if (productId) {
    return { kind: 'product', productId };
  }
  return null;
}

/** Route from push `data` (order detail or product detail). */
export function handlePushNotificationData(
  data: Record<string, unknown> | undefined,
  handlers: {
    onOpenOrder?: (orderId: string) => void;
    onOpenProduct?: (productId: string) => void;
  },
): void {
  const target = getPushNavigationTarget(data);
  if (!target) {
    return;
  }
  if (target.kind === 'order') {
    handlers.onOpenOrder?.(target.orderId);
    return;
  }
  handlers.onOpenProduct?.(target.productId);
}

export function handlePushNotificationResponse(
  response: Notifications.NotificationResponse,
  handlers: {
    onOpenOrder?: (orderId: string) => void;
    onOpenProduct?: (productId: string) => void;
  },
): void {
  handlePushNotificationData(
    response.notification.request.content.data as Record<string, unknown> | undefined,
    handlers,
  );
}

/** When the app was opened from a notification (cold start). */
export async function getPushNotificationLaunchResponse(): Promise<Notifications.NotificationResponse | null> {
  return Notifications.getLastNotificationResponseAsync();
}

export function addOrderNotificationResponseListener(handlers: {
  onOpenOrder?: (orderId: string) => void;
  onOpenProduct?: (productId: string) => void;
}): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    handlePushNotificationResponse(response, handlers);
  });
}
