import Constants from 'expo-constants';

/** Push uses native code from the EAS/dev build; Expo Go does not include it. */
export function isPushAvailable(): boolean {
  return Constants.appOwnership !== 'expo';
}
