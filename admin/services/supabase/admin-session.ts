import { cache } from 'react';

import { MOCK_BUSINESS_ID } from '@/config/constants';
import { isSupabaseConfigured } from '@/config/env';
import { createServerSupabaseClient } from '@/services/supabase/server';
import type { Profile } from '@/types/profile';

export type AdminSession = {
  userId: string;
  profile: Profile;
};

const localDevProfile: Profile = {
  id: 'local-dev-admin',
  email: 'dev@localhost',
  mobile: null,
  name: 'Local admin',
  role: 'admin',
  business_id: MOCK_BUSINESS_ID,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

export const getAdminSession = cache(async (): Promise<AdminSession | { error: 'unauthenticated' | 'unauthorized' }> => {
  if (!isSupabaseConfigured) {
    return { userId: localDevProfile.id, profile: localDevProfile };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { error: 'unauthenticated' };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'unauthenticated' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, mobile, name, role, business_id, created_at, updated_at')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'admin' || !profile.business_id) {
    return { error: 'unauthorized' };
  }

  return {
    userId: user.id,
    profile: profile as Profile,
  };
});
