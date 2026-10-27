'use server';

import { revalidatePath } from 'next/cache';

import { isSupabaseConfigured } from '@/config/env';
import { logAdminAudit } from '@/services/admin-audit';
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

function auditCtx(ctx: AdminContext) {
  return { supabase: ctx.supabase, businessId: ctx.businessId, adminUserId: ctx.userId };
}

function revalidateCommunities(communityId?: string) {
  revalidatePath('/customers/communities');
  revalidatePath('/customers');
  revalidatePath('/orders', 'layout');
  if (communityId) {
    revalidatePath(`/customers/communities/${communityId}`);
  }
}

async function stampOrdersForAddress(
  ctx: AdminContext,
  addressId: string,
  communityId: string | null,
  communityName: string | null,
) {
  const { data: addr } = await ctx.supabase
    .from('customer_addresses')
    .select('customer_id, user_id, pincode')
    .eq('id', addressId)
    .eq('business_id', ctx.businessId)
    .maybeSingle();
  if (!addr || (!addr.customer_id && !addr.user_id)) {
    return;
  }
  let customerId = addr.customer_id as string | null;
  let userId = addr.user_id as string | null;
  if (customerId && !userId) {
    const { data: person } = await ctx.supabase
      .from('customers')
      .select('auth_user_id')
      .eq('id', customerId)
      .eq('business_id', ctx.businessId)
      .maybeSingle();
    userId = (person?.auth_user_id as string | null) ?? null;
  } else if (userId && !customerId) {
    const { data: person } = await ctx.supabase
      .from('customers')
      .select('id')
      .eq('auth_user_id', userId)
      .eq('business_id', ctx.businessId)
      .maybeSingle();
    customerId = (person?.id as string | null) ?? null;
  }
  const parts = [
    customerId ? `customer_id.eq.${customerId}` : null,
    userId ? `user_id.eq.${userId}` : null,
  ].filter(Boolean);
  if (parts.length === 0) {
    return;
  }
  let query = ctx.supabase
    .from('orders')
    .update({ community_id: communityId, community_name: communityName })
    .eq('business_id', ctx.businessId)
    .or(parts.join(','));
  if (addr.pincode) {
    query = query.eq('pincode', addr.pincode);
  }
  await query;
}

async function requireCommunitiesEnabled(ctx: AdminContext): Promise<string | null> {
  const { data, error } = await ctx.supabase
    .from('businesses')
    .select('communities_enabled')
    .eq('id', ctx.businessId)
    .maybeSingle();
  if (error || !(data as { communities_enabled?: boolean } | null)?.communities_enabled) {
    return 'Enable Communities from Customers → Communities first.';
  }
  return null;
}

export async function setCommunitiesEnabled(enabled: boolean): Promise<{ error: string | null }> {
  const ctx = await requireAdmin();
  if ('error' in ctx) {
    return { error: ctx.error };
  }
  const { error } = await ctx.supabase
    .from('businesses')
    .update({ communities_enabled: enabled })
    .eq('id', ctx.businessId);
  if (error) {
    if (error.message.includes('schema cache') || error.code === 'PGRST204' || error.code === 'PGRST205') {
      return {
        error:
          'Community enable is not in this database yet. In the SQL editor, run supabase/migrations/20260924100000_communities_enabled.sql, then try again.',
      };
    }
    return { error: error.message };
  }
  await logAdminAudit(auditCtx(ctx), {
    action: 'community.feature_toggle',
    entityType: 'business',
    entityId: ctx.businessId,
    summary: enabled ? 'Communities enabled' : 'Communities disabled',
  });
  revalidateCommunities();
  return { error: null };
}

export async function saveCommunity(input: {
  id?: string;
  name: string;
}): Promise<{ error: string | null; id?: string }> {
  const ctx = await requireAdmin();
  if ('error' in ctx) {
    return { error: ctx.error };
  }
  const name = input.name.trim();
  if (name.length < 2) {
    return { error: 'Enter a community name.' };
  }
  const gated = await requireCommunitiesEnabled(ctx);
  if (gated) {
    return { error: gated };
  }

  const result = input.id
    ? await ctx.supabase
        .from('communities')
        .update({ name })
        .eq('id', input.id)
        .eq('business_id', ctx.businessId)
        .select('id')
        .maybeSingle()
    : await ctx.supabase
        .from('communities')
        .insert({ business_id: ctx.businessId, name, active: true })
        .select('id')
        .maybeSingle();

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

  await logAdminAudit(auditCtx(ctx), {
    action: input.id ? 'community.update' : 'community.create',
    entityType: 'community',
    entityId: result.data.id,
    summary: input.id ? `Updated community ${name}` : `Added community ${name}`,
  });
  revalidateCommunities(result.data.id);
  return { error: null, id: result.data.id };
}

export async function setCommunityActive(input: {
  id: string;
  active: boolean;
}): Promise<{ error: string | null }> {
  const ctx = await requireAdmin();
  if ('error' in ctx) {
    return { error: ctx.error };
  }
  const gated = await requireCommunitiesEnabled(ctx);
  if (gated) {
    return { error: gated };
  }
  const { data, error } = await ctx.supabase
    .from('communities')
    .update({ active: input.active })
    .eq('id', input.id)
    .eq('business_id', ctx.businessId)
    .select('id, name')
    .maybeSingle();
  if (error || !data) {
    return { error: error?.message ?? 'Could not update this community.' };
  }
  await logAdminAudit(auditCtx(ctx), {
    action: 'community.active',
    entityType: 'community',
    entityId: input.id,
    summary: `${data.name} set ${input.active ? 'active' : 'inactive'}`,
  });
  revalidateCommunities(input.id);
  return { error: null };
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
  const gated = await requireCommunitiesEnabled(ctx);
  if (gated) {
    return { error: gated };
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
    await stampOrdersForAddress(ctx, input.addressId, community.id, community.name);
    revalidateCommunities(input.communityId);
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

  await stampOrdersForAddress(ctx, input.addressId, community.id, community.name);
  await logAdminAudit(auditCtx(ctx), {
    action: 'community.map_address',
    entityType: 'community',
    entityId: input.communityId,
    summary: `Mapped an address to ${community.name}`,
    details: { address_id: input.addressId },
  });
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
  const gated = await requireCommunitiesEnabled(ctx);
  if (gated) {
    return { error: gated };
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
  await stampOrdersForAddress(ctx, input.addressId, null, null);
  await logAdminAudit(auditCtx(ctx), {
    action: 'community.unmap_address',
    entityType: 'community',
    entityId: input.communityId,
    summary: 'Removed community mapping from an address',
    details: { address_id: input.addressId },
  });
  revalidateCommunities(input.communityId);
  return { error: null };
}
