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

/** Shop already loaded in this app session, if any. */
export function peekCachedBusiness(): Business | null {
  return memoryBusiness ?? null;
}

export async function refreshBusiness(): Promise<Business | null> {
  return fetchLiveBusiness();
}

export type ShopBanner = {
  url: string;
  focusY: number;
};

/** Posters published on the home screen, in display order. */
export async function getShopBanners(): Promise<ShopBanner[]> {
  if (!isSupabaseConfigured || !env.businessId) {
    return [];
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase.rpc('get_shop_banners', {
    p_business_id: env.businessId,
  });
  if (error || !Array.isArray(data)) {
    return [];
  }
  return data.flatMap((row) => {
    const record = row as { image_url?: string | null; focus_y?: number | null };
    const url = record.image_url?.trim() ?? '';
    if (!url) {
      return [];
    }
    const focus = Number(record.focus_y);
    return [{ url, focusY: Number.isFinite(focus) ? Math.min(100, Math.max(0, focus)) : 50 }];
  });
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
