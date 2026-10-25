import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@push/preprompt_dismissed';

export async function isNotificationPrepromptDismissed(): Promise<boolean> {
  const value = await AsyncStorage.getItem(KEY);
  return value === '1';
}

export async function setNotificationPrepromptDismissed(): Promise<void> {
  await AsyncStorage.setItem(KEY, '1');
}
