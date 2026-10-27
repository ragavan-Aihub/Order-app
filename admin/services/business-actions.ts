'use server';

import { revalidatePath } from 'next/cache';

import { logAdminAudit, requireAdminAuditContext } from '@/services/admin-audit';

export async function updateBusinessInfo(input: {
  businessId: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  description: string;
}): Promise<{ error: string | null }> {
  const ctx = await requireAdminAuditContext();
  if ('error' in ctx) {
    return { error: ctx.error };
  }
  if (input.businessId !== ctx.businessId) {
    return { error: 'This account cannot change this business.' };
  }

  const name = input.name.trim();
  if (!name) {
    return { error: 'Business name is required.' };
  }

  const { error } = await ctx.supabase
    .from('businesses')
    .update({
      business_name: name,
      phone: input.phone.trim(),
      email: input.email.trim() || null,
      address: input.address.trim() || null,
      description: input.description.trim() || null,
    })
    .eq('id', ctx.businessId);

  if (error) {
    return { error: error.message };
  }

  await logAdminAudit(ctx, {
    action: 'business.info_update',
    entityType: 'business',
    entityId: ctx.businessId,
    summary: `Business info updated (${name})`,
  });

  revalidatePath('/settings/business-info');
  return { error: null };
}

export async function updateBusinessBranding(input: {
  businessId: string;
  logoUrl: string | null;
  bannerUrl: string | null;
}): Promise<{ error: string | null }> {
  const ctx = await requireAdminAuditContext();
  if ('error' in ctx) {
    return { error: ctx.error };
  }
  if (input.businessId !== ctx.businessId) {
    return { error: 'This account cannot change this business.' };
  }

  const { error } = await ctx.supabase
    .from('businesses')
    .update({
      logo_url: input.logoUrl,
      banner_url: input.bannerUrl,
    })
    .eq('id', ctx.businessId);

  if (error) {
    return { error: error.message };
  }

  await logAdminAudit(ctx, {
    action: 'business.branding_update',
    entityType: 'business',
    entityId: ctx.businessId,
    summary: 'Shop logo or banner updated',
  });

  revalidatePath('/settings/branding');
  return { error: null };
}
