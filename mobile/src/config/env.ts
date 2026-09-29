import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra as { samApiUrl?: string } | undefined;

export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  businessId: process.env.EXPO_PUBLIC_BUSINESS_ID ?? '',
  samApiUrl: (process.env.EXPO_PUBLIC_SAM_API_URL ?? extra?.samApiUrl ?? '').trim(),
};

export const isSupabaseConfigured =
  env.supabaseUrl.trim().length > 0 && env.supabaseAnonKey.trim().length > 0;
