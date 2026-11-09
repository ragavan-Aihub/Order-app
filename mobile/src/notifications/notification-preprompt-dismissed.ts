import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@push/preprompt_dismissed';
const USER_KEY = '@push/preprompt_dismissed_user';

/** Guest "Not now" must not stick after Google/email sign-in. */
export async function isNotificationPrepromptDismissed(userId: string | null | undefined): Promise<boolean> {
  if (!userId) {
    return false;
  }
  const [dismissed, storedUser] = await Promise.all([
    AsyncStorage.getItem(KEY),
    AsyncStorage.getItem(USER_KEY),
  ]);
  return dismissed === '1' && storedUser === userId;
}

export async function setNotificationPrepromptDismissed(userId: string): Promise<void> {
  await AsyncStorage.multiSet([
    [KEY, '1'],
    [USER_KEY, userId],
  ]);
}
