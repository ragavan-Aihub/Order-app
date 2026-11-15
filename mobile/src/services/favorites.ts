import AsyncStorage from '@react-native-async-storage/async-storage';

import { getSupabaseClient } from '@/services/supabase';

const PENDING_KEY = 'farm2flavour.pending-favorite';

export async function fetchMyFavoriteIds(): Promise<string[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase.rpc('my_product_favorites');
  if (error || !Array.isArray(data)) {
    return [];
  }
  return data.filter((id): id is string => typeof id === 'string');
}

export async function toggleProductFavorite(productId: string): Promise<{ ok: true; on: boolean } | { ok: false }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false };
  }
  const { data, error } = await supabase.rpc('toggle_product_favorite', { p_product_id: productId });
  if (error) {
    return { ok: false };
  }
  return { ok: true, on: Boolean(data) };
}

export async function rememberPendingFavorite(productId: string) {
  await AsyncStorage.setItem(PENDING_KEY, productId);
}

export async function takePendingFavorite(): Promise<string | null> {
  const id = await AsyncStorage.getItem(PENDING_KEY);
  await AsyncStorage.removeItem(PENDING_KEY);
  return id?.trim() || null;
}
