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

  const { data, error } = await supabase
    .from('businesses')
    .select(
      'id, business_name, logo_url, phone, email, address, description, banner_url, created_at, updated_at',
    )
    .eq('id', session.profile.business_id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Business;
}
