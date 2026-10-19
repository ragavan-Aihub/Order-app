import * as Notifications from 'expo-notifications';
import { Alert, Linking } from 'react-native';

import { productNotifyCopy } from '@/copy/product-notify';

/** After saving notify interest — prompt for permission if still denied. */
export async function ensurePushForProductNotify(): Promise<'granted' | 'denied'> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') {
    return 'granted';
  }
  const { status } = await Notifications.requestPermissionsAsync();
  if (status === 'granted') {
    return 'granted';
  }
  Alert.alert(productNotifyCopy.settingsTitle, productNotifyCopy.settingsBody, [
    { text: productNotifyCopy.settingsNotNow, style: 'cancel' },
    { text: productNotifyCopy.settingsOpen, onPress: () => void Linking.openSettings() },
  ]);
  return 'denied';
}
