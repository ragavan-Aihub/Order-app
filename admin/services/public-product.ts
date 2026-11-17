import { createClient } from '@supabase/supabase-js';

import { env, isSupabaseConfigured } from '@/config/env';

export type PublicProductShare = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
};

/** Public share page only — service role, active products, limited fields. */
export async function getPublicProductForShare(id: string): Promise<PublicProductShare | null> {
  const trimmed = id.trim();
  if (!trimmed || !isSupabaseConfigured) {
    return null;
  }
  const serviceKey = env.supabaseServiceRoleKey.trim();
  const key = serviceKey || env.supabaseAnonKey;
  if (!key) {
    return null;
  }

  const supabase = createClient(env.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from('products')
    .select('id, name, description, image_url, active')
    .eq('id', trimmed)
    .eq('active', true)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id as string,
    name: (data.name as string) || 'Farm2Flavour product',
    description: (data.description as string | null) ?? null,
    imageUrl: (data.image_url as string | null) ?? null,
  };
}
