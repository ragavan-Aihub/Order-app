import AsyncStorage from '@react-native-async-storage/async-storage';

function ackKey(orderId: string, modificationId: string) {
  return `order-mod-seen:${orderId}:${modificationId}`;
}

export async function isModificationAcknowledged(orderId: string, modificationId: string): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(ackKey(orderId, modificationId));
    return value === '1';
  } catch {
    return false;
  }
}

export async function acknowledgeModification(orderId: string, modificationId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(ackKey(orderId, modificationId), '1');
  } catch {
    // ignore
  }
}

export async function orderIdsWithUnacknowledgedAdminMods(
  modsByOrderId: Map<string, { id: string; order_id: string }>,
): Promise<Set<string>> {
  const pending = new Set<string>();
  await Promise.all(
    [...modsByOrderId.entries()].map(async ([orderId, mod]) => {
      const seen = await isModificationAcknowledged(orderId, mod.id);
      if (!seen) {
        pending.add(orderId);
      }
    }),
  );
  return pending;
}
