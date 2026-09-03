import { createBrowserClient } from '@supabase/ssr';

import { env, isSupabaseConfigured } from '@/config/env';

export function createBrowserSupabaseClient() {
  if (!isSupabaseConfigured) {
    return null;
  }

  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
