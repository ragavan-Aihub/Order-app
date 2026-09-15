import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'farm2flavour.entered-shop';

export async function hasEnteredShop() {
  return (await AsyncStorage.getItem(KEY)) === '1';
}

export async function markEnteredShop() {
  await AsyncStorage.setItem(KEY, '1');
}
