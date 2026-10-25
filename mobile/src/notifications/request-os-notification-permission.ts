import * as Notifications from 'expo-notifications';

import { promptOpenNotificationSettings } from '@/notifications/ensure-push-permission';

let requestInFlight: Promise<'granted' | 'denied'> | null = null;

/** One system permission dialog when we can still ask; settings only if OS blocked re-prompt. */
export async function requestOsNotificationPermissionOnce(): Promise<'granted' | 'denied'> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') {
    return 'granted';
  }
  if (existing.status === 'denied' && existing.canAskAgain === false) {
    promptOpenNotificationSettings();
    return 'denied';
  }
  if (requestInFlight) {
    return requestInFlight;
  }
  requestInFlight = (async () => {
    try {
      const result = await Notifications.requestPermissionsAsync();
      if (result.status === 'granted') {
        return 'granted';
      }
      if (result.canAskAgain === false) {
        promptOpenNotificationSettings();
      }
      return 'denied';
    } finally {
      requestInFlight = null;
    }
  })();
  return requestInFlight;
}
