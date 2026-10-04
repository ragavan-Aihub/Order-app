import { env } from '@/config/env';
import type { SavedAddress } from '@/cart/address-book';
import { getSupabaseClient } from '@/services/supabase';
import { toE164India } from '@/utils/validation';

export type AddressRow = {
  id: string;
  user_id: string;
  business_id: string;
  label: 'home' | 'work' | 'other';
  name: string;
  mobile: string;
  alt_mobile: string | null;
  house: string | null;
  locality: string | null;
  address: string;
  city: string | null;
  pincode: string;
  instructions: string | null;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
};

export function rowToSavedAddress(row: AddressRow): SavedAddress {
  return {
    id: row.id,
    name: row.name,
    mobile: row.mobile,
    address: row.address,
    pincode: row.pincode,
    instructions: row.instructions || undefined,
    house: row.house || undefined,
    locality: row.locality || undefined,
    city: row.city || undefined,
    label: row.label === 'work' || row.label === 'other' ? row.label : 'home',
    altMobile: row.alt_mobile || undefined,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
  };
}

export async function fetchRemoteAddresses(): Promise<{ list: SavedAddress[]; defaultId: string | null } | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('customer_addresses')
    .select(
      'id, user_id, business_id, label, name, mobile, alt_mobile, house, locality, address, city, pincode, instructions, lat, lng, is_default',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error || !data) {
    return null;
  }

  const rows = data as AddressRow[];
  const selected = rows.find((row) => row.is_default) ?? rows[0];
  return {
    list: rows.map(rowToSavedAddress),
    defaultId: selected?.id ?? null,
  };
}

export async function setRemoteDefaultAddress(id: string) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Could not switch address.');
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) {
    throw new Error('Sign in to switch address.');
  }
  const { error } = await supabase
    .from('customer_addresses')
    .update({ is_default: true })
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) {
    throw new Error(error.message);
  }
}

export async function replaceRemoteAddresses(
  list: SavedAddress[],
  selectedId: string | null,
): Promise<{ list: SavedAddress[]; selectedId: string | null }> {
  const supabase = getSupabaseClient();
  if (!supabase || !env.businessId) {
    throw new Error('Could not save this address.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Sign in to save a delivery address.');
  }

  const { data: existing } = await supabase.from('customer_addresses').select('id').eq('user_id', user.id);
  const leftover = new Set((existing ?? []).map((row) => row.id as string));
  const next: SavedAddress[] = [];
  let nextSelected = selectedId;

  for (const item of list) {
    const isSelected = item.id === selectedId || (!selectedId && next.length === 0);
    const payload = {
      user_id: user.id,
      business_id: env.businessId,
      label: item.label ?? 'home',
      name: item.name,
      mobile: item.mobile,
      alt_mobile: item.altMobile ?? null,
      house: item.house ?? null,
      locality: item.locality ?? null,
      address: item.address,
      city: item.city ?? null,
      pincode: item.pincode,
      instructions: item.instructions ?? null,
      lat: item.lat ?? null,
      lng: item.lng ?? null,
      is_default: isSelected,
    };

    if (leftover.has(item.id)) {
      const { error } = await supabase.from('customer_addresses').update(payload).eq('id', item.id).eq('user_id', user.id);
      if (error) {
        throw new Error(error.message);
      }
      leftover.delete(item.id);
      next.push(item);
      if (isSelected) {
        nextSelected = item.id;
      }
    } else {
      const { data, error } = await supabase.from('customer_addresses').insert(payload).select('id').single();
      if (error || !data) {
        throw new Error(error?.message ?? 'Could not save address.');
      }
      const saved = { ...item, id: data.id as string };
      next.push(saved);
      if (isSelected) {
        nextSelected = saved.id;
      }
    }
  }

  if (leftover.size) {
    await supabase.from('customer_addresses').delete().eq('user_id', user.id).in('id', [...leftover]);
  }

  if (nextSelected) {
    await supabase.from('customer_addresses').update({ is_default: false }).eq('user_id', user.id).neq('id', nextSelected);
    await supabase.from('customer_addresses').update({ is_default: true }).eq('user_id', user.id).eq('id', nextSelected);
  }

  return { list: next, selectedId: nextSelected };
}

export async function syncCustomerFromAddress(name: string, mobile: string) {
  const supabase = getSupabaseClient();
  if (!supabase || !env.businessId) {
    return;
  }
  await supabase.rpc('ensure_customer_profile', {
    p_business_id: env.businessId,
    p_name: name.trim() || null,
    p_mobile: toE164India(mobile),
  });
}
