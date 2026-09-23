'use server';

import { revalidatePath } from 'next/cache';

import { isSupabaseConfigured } from '@/config/env';
import { createServerSupabaseClient } from '@/services/supabase/server';

type AdminContext = {
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>;
  businessId: string;
  userId: string;
};

async function requireAdmin(): Promise<AdminContext | { error: string }> {
  if (!isSupabaseConfigured) {
    return { error: 'Supabase is not configured.' };
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { error: 'Supabase is not configured.' };
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) {
    return { error: 'You are not signed in as an admin.' };
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, business_id')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile || profile.role !== 'admin' || !profile.business_id) {
    return { error: 'You are not signed in as an admin.' };
  }
  return { supabase, businessId: profile.business_id, userId: user.id };
}

function revalidateCommunities(communityId?: string) {
  revalidatePath('/communities');
  revalidatePath('/orders');
  if (communityId) {
    revalidatePath(`/communities/${communityId}`);
  }
}

export async function saveCommunity(input: {
  id?: string;
  name: string;
  active: boolean;
}): Promise<{ error: string | null; id?: string }> {
  const ctx = await requireAdmin();
  if ('error' in ctx) {
    return { error: ctx.error };
  }
  const name = input.name.trim();
  if (name.length < 2) {
    return { error: 'Enter a community name.' };
  }

  const row = { business_id: ctx.businessId, name, active: input.active };
  const result = input.id
    ? await ctx.supabase
        .from('communities')
        .update({ name, active: input.active })
        .eq('id', input.id)
        .eq('business_id', ctx.businessId)
        .select('id')
        .maybeSingle()
    : await ctx.supabase.from('communities').insert(row).select('id').maybeSingle();

  if (result.error || !result.data) {
    if (result.error?.code === '23505') {
      return { error: 'A community with this name already exists.' };
    }
    if (result.error?.message?.includes('schema cache') || result.error?.code === 'PGRST205') {
      return {
        error:
          'Communities are not in this database yet. In the SQL editor, run supabase/migrations/20260923100000_communities.sql, then try again.',
      };
    }
    return { error: result.error?.message ?? 'Could not save the community.' };
  }

  revalidateCommunities(result.data.id);
  return { error: null, id: result.data.id };
}

export async function mapAddressToCommunity(input: {
  communityId: string;
  addressId: string;
  confirmMove?: boolean;
}): Promise<{
  error: string | null;
  needsConfirm?: boolean;
  currentCommunityName?: string;
}> {
  const ctx = await requireAdmin();
  if ('error' in ctx) {
    return { error: ctx.error };
  }

  const { data: community } = await ctx.supabase
    .from('communities')
    .select('id, active, name')
    .eq('id', input.communityId)
    .eq('business_id', ctx.businessId)
    .maybeSingle();
  if (!community) {
    return { error: 'Community not found.' };
  }
  if (!community.active) {
    return { error: 'This community is inactive. Activate it before mapping addresses.' };
  }

  const { data: address } = await ctx.supabase
    .from('customer_addresses')
    .select('id, community_id')
    .eq('id', input.addressId)
    .eq('business_id', ctx.businessId)
    .maybeSingle();
  if (!address) {
    return { error: 'Address not found.' };
  }
  if (address.community_id === input.communityId) {
    return { error: null };
  }
  if (address.community_id && !input.confirmMove) {
    const { data: other } = await ctx.supabase
      .from('communities')
      .select('name')
      .eq('id', address.community_id)
      .maybeSingle();
    return {
      error: null,
      needsConfirm: true,
      currentCommunityName: other?.name ?? 'another community',
    };
  }

  const { error } = await ctx.supabase
    .from('customer_addresses')
    .update({ community_id: input.communityId })
    .eq('id', input.addressId)
    .eq('business_id', ctx.businessId);
  if (error) {
    if (error.message.includes('already mapped to another community')) {
      return {
        error:
          'This database still limits one community per customer. In the SQL editor, run supabase/migrations/20260923110000_community_address_mapping.sql, then try again.',
      };
    }
    return { error: error.message };
  }

  revalidateCommunities(input.communityId);
  if (address.community_id) {
    revalidateCommunities(address.community_id);
  }
  return { error: null };
}

export async function unmapAddressFromCommunity(input: {
  communityId: string;
  addressId: string;
}): Promise<{ error: string | null }> {
  const ctx = await requireAdmin();
  if ('error' in ctx) {
    return { error: ctx.error };
  }

  const { error } = await ctx.supabase
    .from('customer_addresses')
    .update({ community_id: null })
    .eq('id', input.addressId)
    .eq('business_id', ctx.businessId)
    .eq('community_id', input.communityId);
  if (error) {
    return { error: error.message };
  }
  revalidateCommunities(input.communityId);
  return { error: null };
}
