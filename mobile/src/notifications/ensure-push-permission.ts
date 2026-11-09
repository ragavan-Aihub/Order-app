import { Alert, Linking } from 'react-native';

import { productNotifyCopy } from '@/copy/product-notify';
import { requestNotificationPermissionViaPreprompt } from '@/notifications/notification-permission-prequest';
import { ensureAndroidOrderNotificationChannel, registerForOrderPush } from '@/notifications/order-push';
import { isPushAvailable } from '@/notifications/push-runtime';

export function promptOpenNotificationSettings(): void {
  Alert.alert(productNotifyCopy.settingsTitle, productNotifyCopy.settingsBody, [
    { text: productNotifyCopy.settingsNotNow, style: 'cancel' },
    { text: productNotifyCopy.settingsOpen, onPress: () => void Linking.openSettings() },
  ]);
}

/** Notify me: custom sheet (why we notify) then one system dialog; Settings if OS blocked. */
export async function ensurePushForProductNotify(): Promise<'granted' | 'denied'> {
  if (!isPushAvailable()) {
    return 'denied';
  }

  const Notifications = await import('expo-notifications');
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') {
    return 'granted';
  }

  if (existing.status === 'denied' && existing.canAskAgain === false) {
    promptOpenNotificationSettings();
    return 'denied';
  }

  return requestNotificationPermissionViaPreprompt();
}

/** Home "Not now" must not skip alerts for a new order. Ask again on the confirmation screen. */
export async function offerNotificationsAfterPlacingOrder(): Promise<void> {
  if (!isPushAvailable()) {
    return;
  }

  await ensureAndroidOrderNotificationChannel();
  const Notifications = await import('expo-notifications');
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') {
    await registerForOrderPush();
    return;
  }
  if (existing.status === 'denied' && existing.canAskAgain === false) {
    return;
  }

  await requestNotificationPermissionViaPreprompt();
}
