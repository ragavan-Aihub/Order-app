import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'farm2flavour.entered-shop';

let enteredThisSession = false;

AsyncStorage.removeItem(KEY).catch(() => undefined);

export async function hasEnteredShop() {
  return enteredThisSession;
}

export async function markEnteredShop() {
  enteredThisSession = true;
}
