'use server';

import { createHash, randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';

import { PARTNER_CHANNELS, PARTNER_SCOPES } from '@/lib/partner-constants';
import { isSupabaseConfigured } from '@/config/env';
import { createServerSupabaseClient } from '@/services/supabase/server';

export type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  channel: string;
  scopes: string[];
  active: boolean;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

function hashKey(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

async function requireAdminClient() {
  if (!isSupabaseConfigured) {
    return { error: 'Supabase is not configured.' as const, supabase: null, businessId: null };
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { error: 'Supabase is not configured.' as const, supabase: null, businessId: null };
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) {
    return { error: 'You are not signed in as an admin.' as const, supabase: null, businessId: null };
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, business_id')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile || profile.role !== 'admin' || !profile.business_id) {
    return { error: 'You are not signed in as an admin.' as const, supabase: null, businessId: null };
  }
  return { error: null, supabase, businessId: profile.business_id as string };
}

export async function listApiKeys(): Promise<ApiKeyRow[]> {
  const auth = await requireAdminClient();
  if (auth.error || !auth.supabase) {
    return [];
  }
  const { data } = await auth.supabase
    .from('api_keys')
    .select('id, name, key_prefix, channel, scopes, active, last_used_at, revoked_at, created_at')
    .eq('business_id', auth.businessId)
    .order('created_at', { ascending: false });
  return (data ?? []) as ApiKeyRow[];
}

export async function createApiKey(
  name: string,
  channel: string,
): Promise<{ error: string | null; secret?: string; prefix?: string }> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { error: 'Give this key a name.' };
  }
  if (!PARTNER_CHANNELS.some((item) => item.id === channel)) {
    return { error: 'Choose API or WhatsApp.' };
  }

  const auth = await requireAdminClient();
  if (auth.error || !auth.supabase || !auth.businessId) {
    return { error: auth.error ?? 'Could not create the key.' };
  }

  const prefix = `qk_live_${randomBytes(4).toString('hex')}`;
  const secret = `${prefix}_${randomBytes(24).toString('hex')}`;

  const { error } = await auth.supabase.from('api_keys').insert({
    business_id: auth.businessId,
    name: trimmed,
    key_prefix: prefix,
    key_hash: hashKey(secret),
    channel,
    scopes: [...PARTNER_SCOPES],
    active: true,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/settings/api');
  return { error: null, secret, prefix };
}

export async function revokeApiKey(id: string): Promise<{ error: string | null }> {
  const auth = await requireAdminClient();
  if (auth.error || !auth.supabase || !auth.businessId) {
    return { error: auth.error ?? 'Could not revoke the key.' };
  }

  const { data, error } = await auth.supabase
    .from('api_keys')
    .update({ active: false, revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('business_id', auth.businessId)
    .select('id')
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }
  if (!data) {
    return { error: 'Could not revoke this key.' };
  }
  revalidatePath('/settings/api');
  return { error: null };
}
