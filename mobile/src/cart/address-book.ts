import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearDeliveryDraft, saveDeliveryDraft } from '@/cart/delivery-draft';
import { fetchRemoteAddresses, replaceRemoteAddresses } from '@/services/addresses';
import type { DeliveryDetails } from '@/services/orders';
import { composeAddressLine, stateFromPincode, type AddressLabel } from '@/utils/address';

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

const BOOK_KEY = 'farm2flavour.address-book.v1';
const SELECTED_KEY = 'farm2flavour.address-selected.v1';
const MANAGED_KEY = 'farm2flavour.address-book.managed';
const INSTRUCTIONS_MARKER = '\n\nDelivery instructions: ';
export const MAX_SAVED_ADDRESSES = 3;

let book: SavedAddress[] | null = null;
let selectedId: string | null = null;
let managed = false;
let loaded = false;
let loadPromise: Promise<SavedAddress[]> | null = null;

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

function isSamePlace(a: SavedAddress | DeliveryDetails, b: SavedAddress | DeliveryDetails) {
  return (
    a.pincode.trim() === b.pincode.trim() &&
    a.address.trim().toLowerCase() === b.address.trim().toLowerCase() &&
    a.mobile.replace(/\D/g, '').slice(-10) === b.mobile.replace(/\D/g, '').slice(-10)
  );
}

function parseBook(raw: string): SavedAddress[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is SavedAddress => {
      if (!item || typeof item !== 'object') {
        return false;
      }
      const row = item as SavedAddress;
      return (
        typeof row.id === 'string' &&
        typeof row.name === 'string' &&
        typeof row.mobile === 'string' &&
        typeof row.address === 'string' &&
        typeof row.pincode === 'string'
      );
    });
  } catch {
    return [];
  }
}

async function persistLocal() {
  managed = true;
  await AsyncStorage.multiSet([
    [BOOK_KEY, JSON.stringify(book ?? [])],
    [SELECTED_KEY, selectedId ?? ''],
    [MANAGED_KEY, '1'],
  ]);
}

async function persist() {
  try {
    const synced = await replaceRemoteAddresses(book ?? [], selectedId);
    book = synced.list;
    selectedId = synced.selectedId;
  } catch {
    // Keep the on-device book if the network is down.
  }
  await persistLocal();
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

export async function loadAddressBook(): Promise<SavedAddress[]> {
  if (!loadPromise) {
    loadPromise = (async () => {
      const [[, bookRaw], [, selectedRaw], [, managedRaw]] = await AsyncStorage.multiGet([
        BOOK_KEY,
        SELECTED_KEY,
        MANAGED_KEY,
      ]);
      book = bookRaw ? parseBook(bookRaw) : [];
      selectedId = selectedRaw || book[0]?.id || null;
      managed = managedRaw === '1' || book.length > 0;
      loaded = true;
      return book ?? [];
    })();
  }
  await loadPromise;

  const remote = await fetchRemoteAddresses().catch(() => null);
  if (remote) {
    if (remote.list.length > 0) {
      book = remote.list;
      selectedId = remote.defaultId ?? remote.list[0]?.id ?? null;
      managed = true;
      await persistLocal();
    } else if ((book ?? []).length > 0) {
      await persist();
    }
  }
  return book ?? [];
}

export async function hydrateAddressBook(seeds: Array<DeliveryDetails | null | undefined>) {
  await loadAddressBook();
  if (managed || (book ?? []).length > 0) {
    return;
  }
  let changed = false;
  for (const seed of seeds) {
    if (!seed?.address?.trim() || !seed.pincode?.trim()) {
      continue;
    }
    const split = splitDeliveryAddress(seed.address);
    const candidate: SavedAddress = {
      id: newId(),
      name: seed.name.trim(),
      mobile: seed.mobile.trim(),
      address: split.address,
      pincode: seed.pincode.trim(),
      instructions: split.instructions,
      label: 'home',
    };
    if ((book ?? []).some((item) => isSamePlace(item, candidate))) {
      continue;
    }
    if ((book ?? []).length >= MAX_SAVED_ADDRESSES) {
      break;
    }
    book = [...(book ?? []), candidate];
    changed = true;
    if (!selectedId) {
      selectedId = candidate.id;
    }
  }
  if (changed) {
    await persist();
    const current = getSelectedAddress();
    if (current) {
      await saveDeliveryDraft(current);
    }
  }
}

export async function upsertAddress(input: Omit<SavedAddress, 'id'> & { id?: string }) {
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
  await persist();
  await saveDeliveryDraft(next);
  return next;
}

export async function deleteAddress(id: string) {
  await loadAddressBook();
  book = (book ?? []).filter((item) => item.id !== id);
  if (selectedId === id) {
    selectedId = book[0]?.id ?? null;
  }
  await persist();
  const current = getSelectedAddress();
  if (current) {
    await saveDeliveryDraft(current);
  } else {
    await clearDeliveryDraft();
  }
}

export async function selectAddress(id: string) {
  await loadAddressBook();
  if (!(book ?? []).some((item) => item.id === id)) {
    return;
  }
  selectedId = id;
  await persist();
  const current = getSelectedAddress();
  if (current) {
    await saveDeliveryDraft(current);
  }
}
