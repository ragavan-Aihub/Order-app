import { Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Top inset for headers; Android Expo Go sometimes reports 0 while a status bar is still shown. */
export function useTopInset() {
  const insets = useSafeAreaInsets();
  const androidBar = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
  return Math.max(insets.top, androidBar);
}
