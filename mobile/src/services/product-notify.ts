import { getSupabaseClient } from '@/services/supabase';

export async function fetchMyProductNotifyIds(): Promise<string[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return [];
  }
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    return [];
  }
  const { data, error } = await supabase.rpc('my_product_notify_interests');
  if (error) {
    if (__DEV__) {
      console.warn('[product-notify] my_product_notify_interests', error.message);
    }
    return [];
  }
  return (data ?? []) as string[];
}

export async function upsertProductNotifyInterest(
  productId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, message: 'Not connected.' };
  }
  const { error } = await supabase.rpc('upsert_product_notify_interest', { p_product_id: productId });
  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true };
}

export async function removeProductNotifyInterest(
  productId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, message: 'Not connected.' };
  }
  const { error } = await supabase.rpc('remove_product_notify_interest', { p_product_id: productId });
  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true };
}
