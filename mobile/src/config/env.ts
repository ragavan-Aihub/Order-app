export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  businessId: process.env.EXPO_PUBLIC_BUSINESS_ID ?? '',
};

export const isSupabaseConfigured =
  env.supabaseUrl.trim().length > 0 && env.supabaseAnonKey.trim().length > 0;
