import { env, isSupabaseConfigured } from '@/config/env';
import { getSupabaseClient } from '@/services/supabase';
import type { Business } from '@/types/business';

export async function getBusiness(): Promise<Business | null> {
  if (!isSupabaseConfigured || !env.businessId) {
    return null;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.rpc('get_business_public', {
    p_business_id: env.businessId,
  });

  if (error || !data) {
    return null;
  }

  const rows = data as Business[];
  return rows[0] ?? null;
}
