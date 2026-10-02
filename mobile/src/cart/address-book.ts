import { clearDeliveryDraft } from '@/cart/delivery-draft';
import { fetchRemoteAddresses, replaceRemoteAddresses, syncCustomerFromAddress } from '@/services/addresses';
import type { DeliveryDetails } from '@/services/orders';
import { getSignedInUser } from '@/services/supabase';
import { ADDRESS_LABELS, composeAddressLine, stateFromPincode, type AddressLabel } from '@/utils/address';

export type { AddressLabel };

export type SavedAddress = DeliveryDetails & {
  id: string;
  instructions?: string;
  house?: string;
  locality?: string;
  label?: AddressLabel;
  altMobile?: string;
  lat?: number;
  lng?: number;
};

const INSTRUCTIONS_MARKER = '\n\nDelivery instructions: ';
export const MAX_SAVED_ADDRESSES = 3;

let book: SavedAddress[] | null = null;
let selectedId: string | null = null;
let emittedFingerprint: string | null = null;
let inflightLoad: Promise<SavedAddress[]> | null = null;
const listeners = new Set<() => void>();

export function subscribeAddressBook(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emitAddressBook() {
  const fingerprint = JSON.stringify([selectedId, book]);
  if (fingerprint === emittedFingerprint) {
    return;
  }
  emittedFingerprint = fingerprint;
  for (const listener of listeners) {
    listener();
  }
}

function newId() {
  const cryptoObj = globalThis.crypto as Crypto | undefined;
  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function splitDeliveryAddress(raw: string): { address: string; instructions: string } {
  const index = raw.indexOf(INSTRUCTIONS_MARKER);
  if (index === -1) {
    return { address: raw, instructions: '' };
  }
  return {
    address: raw.slice(0, index).trim(),
    instructions: raw.slice(index + INSTRUCTIONS_MARKER.length).trim(),
  };
}

export function formatSavedAddressLabel(label?: AddressLabel) {
  return ADDRESS_LABELS.find((item) => item.value === (label ?? 'home'))?.label ?? 'Home';
}

export function formatSavedAddressLine(item: SavedAddress) {
  return [
    composeAddressLine(item.house ?? '', item.address, item.locality ?? '', stateFromPincode(item.pincode)),
    item.pincode,
  ]
    .filter(Boolean)
    .join(', ');
}

export function formatAddressForOrder(details: SavedAddress): string {
  const line = composeAddressLine(
    details.house ?? '',
    details.address,
    details.locality ?? '',
    stateFromPincode(details.pincode),
  );
  const unique = line
    .split(',')
    .map((part) => part.trim())
    .filter((part, index, all) => part && all.findIndex((item) => item.toLowerCase() === part.toLowerCase()) === index)
    .join(', ');
  const note = details.instructions?.trim();
  return note ? `${unique}${INSTRUCTIONS_MARKER}${note}` : unique;
}

export function getAddressBook(): SavedAddress[] {
  return book ?? [];
}

export function getSelectedAddress(): SavedAddress | null {
  const list = getAddressBook();
  if (selectedId) {
    return list.find((item) => item.id === selectedId) ?? list[0] ?? null;
  }
  return list[0] ?? null;
}

function applyRemote(list: SavedAddress[], defaultId: string | null) {
  book = list;
  selectedId = (defaultId && list.some((item) => item.id === defaultId) ? defaultId : list[0]?.id) ?? null;
  emitAddressBook();
}

function clearMemory() {
  book = [];
  selectedId = null;
  emitAddressBook();
}

export function resetAddressBookCache() {
  clearMemory();
}

async function persist() {
  const synced = await replaceRemoteAddresses(book ?? [], selectedId);
  applyRemote(synced.list, synced.selectedId);
}

export function loadAddressBook(): Promise<SavedAddress[]> {
  if (!inflightLoad) {
    inflightLoad = (async () => {
      const user = await getSignedInUser();
      if (!user) {
        clearMemory();
        return [];
      }
      const remote = await fetchRemoteAddresses().catch(() => null);
      if (!remote) {
        book = book ?? [];
        return book;
      }
      applyRemote(remote.list, remote.defaultId);
      return book ?? [];
    })().finally(() => {
      inflightLoad = null;
    });
  }
  return inflightLoad;
}

export async function hydrateAddressBook(_seeds?: Array<DeliveryDetails | null | undefined>) {
  await loadAddressBook();
}

export async function upsertAddress(input: Omit<SavedAddress, 'id'> & { id?: string }) {
  const user = await getSignedInUser();
  if (!user) {
    throw new Error('Sign in to save a delivery address.');
  }
  await loadAddressBook();
  const next: SavedAddress = {
    id: input.id && (book ?? []).some((item) => item.id === input.id) ? input.id : newId(),
    name: input.name.trim(),
    mobile: input.mobile.trim(),
    address: input.address.trim(),
    pincode: input.pincode.trim(),
    instructions: input.instructions?.trim() || undefined,
    house: input.house?.trim() || undefined,
    locality: input.locality?.trim() || undefined,
    label: input.label ?? 'home',
    altMobile: input.altMobile?.trim() || undefined,
    lat: input.lat,
    lng: input.lng,
  };
  const list = book ?? [];
  const index = list.findIndex((item) => item.id === next.id);
  if (index < 0 && list.length >= MAX_SAVED_ADDRESSES) {
    throw new Error('You can save up to 3 addresses. Delete one to add another.');
  }
  book = index >= 0 ? list.map((item) => (item.id === next.id ? next : item)) : [...list, next];
  selectedId = next.id;
  try {
    await persist();
  } catch (error) {
    await loadAddressBook();
    throw error;
  }
  await syncCustomerFromAddress(next.name, next.mobile);
  return next;
}

export async function deleteAddress(id: string) {
  const user = await getSignedInUser();
  if (!user) {
    return;
  }
  await loadAddressBook();
  book = (book ?? []).filter((item) => item.id !== id);
  if (selectedId === id) {
    selectedId = book[0]?.id ?? null;
  }
  try {
    await persist();
  } catch (error) {
    await loadAddressBook();
    throw error;
  }
  if (!getSelectedAddress()) {
    await clearDeliveryDraft();
  }
}

export async function selectAddress(id: string) {
  const user = await getSignedInUser();
  if (!user) {
    return;
  }
  await loadAddressBook();
  if (!(book ?? []).some((item) => item.id === id)) {
    return;
  }
  selectedId = id;
  try {
    await persist();
  } catch (error) {
    await loadAddressBook();
    throw error;
  }
}
