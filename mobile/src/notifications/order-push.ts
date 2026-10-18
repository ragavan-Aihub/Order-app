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

  const { status: existing } = await Notifications.getPermissionsAsync();
  let permission = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    permission = status;
  }
  if (permission !== 'granted') {
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

export function addOrderNotificationResponseListener(
  onOpenOrder: (orderId: string) => void,
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const orderId = response.notification.request.content.data?.orderId;
    if (typeof orderId === 'string' && orderId.length > 0) {
      onOpenOrder(orderId);
    }
  });
}
