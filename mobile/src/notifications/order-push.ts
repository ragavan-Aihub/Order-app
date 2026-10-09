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

/** Register this device for order status push (confirmation, out for delivery, delivered). */
export async function registerForOrderPush(): Promise<void> {
  if (!Device.isDevice) {
    return;
  }

  await ensureAndroidChannel();

  const { status: existing } = await Notifications.getPermissionsAsync();
  let permission = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    permission = status;
  }
  if (permission !== 'granted') {
    return;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.easProjectId;

  if (!projectId) {
    return;
  }

  const push = await Notifications.getExpoPushTokenAsync({ projectId });
  const platform =
    Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web'
      ? Platform.OS
      : 'unknown';

  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  const { error } = await supabase.rpc('upsert_push_token', {
    p_token: push.data,
    p_platform: platform,
  });
  if (error) {
    console.warn('[push] upsert_push_token', error.message);
  }
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
