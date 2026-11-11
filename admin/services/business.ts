import { getAdminSession } from '@/services/supabase/admin-session';
import { createServerSupabaseClient } from '@/services/supabase/server';
import type { Business } from '@/types/business';

export async function getAdminBusiness(): Promise<Business | null> {
  const session = await getAdminSession();
  if ('error' in session || !session.profile.business_id) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return null;
  }

  const columns =
    'id, business_name, logo_url, phone, email, address, description, banner_url, shop_closed, shop_closed_message, min_order_amount, announcement_active, announcement_title, announcement_body, announcement_image_url, created_at, updated_at';
  const { data, error } = await supabase
    .from('businesses')
    .select(columns)
    .eq('id', session.profile.business_id)
    .maybeSingle();

  if (!error && data) {
    return data as Business;
  }

  const fallback = await supabase
    .from('businesses')
    .select(
      'id, business_name, logo_url, phone, email, address, description, banner_url, shop_closed, shop_closed_message, announcement_active, announcement_title, announcement_body, announcement_image_url, created_at, updated_at',
    )
    .eq('id', session.profile.business_id)
    .maybeSingle();

  if (fallback.error || !fallback.data) {
    return null;
  }

  return { ...(fallback.data as Business), min_order_amount: 0 };
}

export async function getAdminShopBanners(
  businessId: string,
): Promise<{ id: string; image_url: string; sort_order: number; focus_y: number }[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from('shop_banners')
    .select('id, image_url, sort_order, focus_y')
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error || !data) {
    return [];
  }
  return data as { id: string; image_url: string; sort_order: number; focus_y: number }[];
}

export async function isCommunitiesEnabled(): Promise<boolean> {
  const session = await getAdminSession();
  if ('error' in session || !session.profile.business_id) {
    return false;
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return false;
  }
  const { data, error } = await supabase
    .from('businesses')
    .select('communities_enabled')
    .eq('id', session.profile.business_id)
    .maybeSingle();
  if (error || !data) {
    return false;
  }
  return Boolean((data as { communities_enabled?: boolean }).communities_enabled);
}

export async function isCategoriesEnabled(): Promise<boolean> {
  const session = await getAdminSession();
  if ('error' in session || !session.profile.business_id) {
    return false;
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return false;
  }
  const { data, error } = await supabase
    .from('businesses')
    .select('categories_enabled')
    .eq('id', session.profile.business_id)
    .maybeSingle();
  if (error || !data) {
    return false;
  }
  return Boolean((data as { categories_enabled?: boolean }).categories_enabled);
}
