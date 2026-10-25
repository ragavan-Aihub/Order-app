import * as Notifications from 'expo-notifications';
import { Alert, Linking } from 'react-native';

import { productNotifyCopy } from '@/copy/product-notify';
import { requestNotificationPermissionViaPreprompt } from '@/notifications/notification-permission-prequest';
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
