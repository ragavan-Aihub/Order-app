import { env, isSupabaseConfigured } from '@/config/env';
import { readCachedBusiness, writeCachedBusiness } from '@/services/catalog-cache';
import { getSupabaseClient } from '@/services/supabase';
import type { Business } from '@/types/business';

export async function getBusiness(): Promise<Business | null> {
  if (!isSupabaseConfigured || !env.businessId) {
    return readCachedBusiness();
  }

  const cached = await readCachedBusiness();
  const supabase = getSupabaseClient();
  if (!supabase) {
    return cached;
  }

  try {
    const { data, error } = await supabase.rpc('get_business_public', {
      p_business_id: env.businessId,
    });

    if (error || !data) {
      return cached;
    }

    const rows = data as Business[];
    const business = rows[0] ?? null;
    if (business) {
      await writeCachedBusiness(business);
    }
    return business ?? cached;
  } catch {
    return cached;
  }
}
