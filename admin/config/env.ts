export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  /** Server-only. Used to invoke push Edge Function after status changes. Never expose to the client. */
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
};

export const isSupabaseConfigured =
  env.supabaseUrl.trim().length > 0 && env.supabaseAnonKey.trim().length > 0;
