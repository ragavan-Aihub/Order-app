import { env, isSupabaseConfigured } from '@/config/env';
import { readCachedBusiness, writeCachedBusiness } from '@/services/catalog-cache';
import { getSupabaseClient } from '@/services/supabase';
import type { Business } from '@/types/business';

let memoryBusiness: Business | null | undefined;
let inflight: Promise<Business | null> | null = null;

async function fetchLiveBusiness(): Promise<Business | null> {
  if (inflight) {
    return inflight;
  }
  inflight = (async () => {
    const cached = memoryBusiness === undefined ? await readCachedBusiness() : memoryBusiness;
    if (!isSupabaseConfigured || !env.businessId) {
      memoryBusiness = cached ?? null;
      return memoryBusiness;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      memoryBusiness = cached ?? null;
      return memoryBusiness;
    }
    try {
      const { data, error } = await supabase.rpc('get_business_public', {
        p_business_id: env.businessId,
      });
      if (error || !data) {
        memoryBusiness = cached ?? null;
        return memoryBusiness;
      }
      const rows = data as Business[];
      const business = rows[0] ?? null;
      if (business) {
        memoryBusiness = business;
        void writeCachedBusiness(business);
      } else {
        memoryBusiness = cached ?? null;
      }
      return memoryBusiness ?? null;
    } catch {
      memoryBusiness = cached ?? null;
      return memoryBusiness;
    }
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export async function refreshBusiness(): Promise<Business | null> {
  return fetchLiveBusiness();
}

export async function getBusiness(): Promise<Business | null> {
  if (memoryBusiness !== undefined) {
    void fetchLiveBusiness();
    return memoryBusiness;
  }
  const cached = await readCachedBusiness();
  if (cached) {
    memoryBusiness = cached;
    void fetchLiveBusiness();
    return cached;
  }
  return fetchLiveBusiness();
}
