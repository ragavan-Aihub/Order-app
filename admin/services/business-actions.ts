'use server';

import { revalidatePath } from 'next/cache';

import { env } from '@/config/env';
import { notifyShopAnnouncement } from '@/lib/shop-announcement-push';
import { logAdminAudit, requireAdminAuditContext } from '@/services/admin-audit';

const MAX_POSTERS = 8;
const MAX_NOTICE_LENGTH = 280;

function isOwnShopImageUrl(url: string, businessId: string): boolean {
  const base = env.supabaseUrl.trim().replace(/\/$/, '');
  if (!base) {
    return false;
  }
  let parsed: URL;
  let expected: URL;
  try {
    parsed = new URL(url);
    expected = new URL(base);
  } catch {
    return false;
  }
  if (parsed.origin !== expected.origin || parsed.username || parsed.password) {
    return false;
  }
  const prefix = `/storage/v1/object/public/business-logos/${businessId}/`;
  return parsed.pathname.startsWith(prefix) && !parsed.pathname.includes('..');
}

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

  const logoUrl = input.logoUrl?.trim() || null;
  const bannerUrl = input.bannerUrl?.trim() || null;
  if ((logoUrl && !isOwnShopImageUrl(logoUrl, ctx.businessId)) || (bannerUrl && !isOwnShopImageUrl(bannerUrl, ctx.businessId))) {
    return { error: 'Use an image uploaded for this shop.' };
  }

  const { error } = await ctx.supabase
    .from('businesses')
    .update({
      logo_url: logoUrl,
      banner_url: bannerUrl,
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
  revalidatePath('/settings/business-info');
  return { error: null };
}

export async function updateShopClosed(input: {
  businessId: string;
  shopClosed: boolean;
  shopClosedMessage: string;
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
      shop_closed: input.shopClosed,
      shop_closed_message: input.shopClosedMessage.trim().slice(0, MAX_NOTICE_LENGTH) || null,
    })
    .eq('id', ctx.businessId);

  if (error) {
    return { error: error.message };
  }

  await logAdminAudit(ctx, {
    action: 'business.shop_closed_update',
    entityType: 'business',
    entityId: ctx.businessId,
    summary: input.shopClosed ? 'Shop marked closed' : 'Shop reopened for orders',
  });

  revalidatePath('/settings/shop-closed');
  return { error: null };
}

export async function updateMinOrderAmount(input: {
  businessId: string;
  minOrderAmount: number;
}): Promise<{ error: string | null }> {
  const ctx = await requireAdminAuditContext();
  if ('error' in ctx) {
    return { error: ctx.error };
  }
  if (input.businessId !== ctx.businessId) {
    return { error: 'This account cannot change this business.' };
  }

  const amount = Number(input.minOrderAmount);
  if (!Number.isFinite(amount) || amount < 0) {
    return { error: 'Enter a valid minimum order amount, or 0 for none.' };
  }
  const minOrderAmount = Math.round(amount * 100) / 100;

  const { error } = await ctx.supabase
    .from('businesses')
    .update({ min_order_amount: minOrderAmount })
    .eq('id', ctx.businessId);

  if (error) {
    return { error: error.message };
  }

  await logAdminAudit(ctx, {
    action: 'business.min_order_update',
    entityType: 'business',
    entityId: ctx.businessId,
    summary:
      minOrderAmount > 0 ? `Minimum order set to ₹${minOrderAmount}` : 'Minimum order turned off',
  });

  revalidatePath('/settings/preferences');
  return { error: null };
}

export async function saveShopBanners(input: {
  businessId: string;
  posters: { imageUrl: string; focusY: number; notify?: boolean }[];
  active: boolean;
}): Promise<{ error: string | null; pushNote: string | null }> {
  const ctx = await requireAdminAuditContext();
  if ('error' in ctx) {
    return { error: ctx.error, pushNote: null };
  }
  if (input.businessId !== ctx.businessId) {
    return { error: 'This account cannot change this business.', pushNote: null };
  }

  if (input.posters.length > MAX_POSTERS) {
    return { error: '8 posters is the maximum.', pushNote: null };
  }
  const posters = input.posters
    .map((poster) => ({
      imageUrl: poster.imageUrl.trim(),
      focusY: Math.min(100, Math.max(0, Math.round(poster.focusY))),
      notify: poster.notify === true,
    }))
    .filter((poster) => isOwnShopImageUrl(poster.imageUrl, ctx.businessId));
  if (posters.length !== input.posters.length) {
    return { error: 'Each poster must be an image uploaded for this shop.', pushNote: null };
  }
  if (input.active && posters.length === 0) {
    return { error: 'Add a poster before showing announcements.', pushNote: null };
  }

  if (posters.length > 0) {
    const { data: inserted, error: insertError } = await ctx.supabase
      .from('shop_banners')
      .insert(
        posters.map((poster, sort_order) => ({
          business_id: ctx.businessId,
          image_url: poster.imageUrl,
          focus_y: poster.focusY,
          sort_order,
        })),
      )
      .select('id');
    if (insertError) {
      return { error: insertError.message, pushNote: null };
    }
    const keep = new Set((inserted ?? []).map((row) => row.id as string));
    const { data: existing, error: listError } = await ctx.supabase
      .from('shop_banners')
      .select('id')
      .eq('business_id', ctx.businessId);
    if (listError) {
      return { error: listError.message, pushNote: null };
    }
    const remove = (existing ?? []).map((row) => row.id as string).filter((id) => !keep.has(id));
    if (remove.length > 0) {
      const { error: deleteError } = await ctx.supabase.from('shop_banners').delete().in('id', remove);
      if (deleteError) {
        return { error: deleteError.message, pushNote: null };
      }
    }
  } else {
    const { error: deleteError } = await ctx.supabase
      .from('shop_banners')
      .delete()
      .eq('business_id', ctx.businessId);
    if (deleteError) {
      return { error: deleteError.message, pushNote: null };
    }
  }

  const { error } = await ctx.supabase
    .from('businesses')
    .update({
      announcement_active: input.active && posters.length > 0,
      announcement_title: null,
      announcement_body: null,
      announcement_image_url: posters[0]?.imageUrl ?? null,
    })
    .eq('id', ctx.businessId);

  if (error) {
    return { error: error.message, pushNote: null };
  }

  await logAdminAudit(ctx, {
    action: 'business.announcement_update',
    entityType: 'business',
    entityId: ctx.businessId,
    summary: input.active ? `Published ${posters.length} shop poster${posters.length === 1 ? '' : 's'}` : 'Announcements hidden',
  });

  revalidatePath('/settings/announcements');

  const alertUrls = posters.filter((poster) => poster.notify).map((poster) => poster.imageUrl);
  if (alertUrls.length === 0) {
    return { error: null, pushNote: null };
  }
  if (!input.active || posters.length === 0) {
    return {
      error: null,
      pushNote: 'Saved. Show the posters before sending a phone alert.',
    };
  }

  const sent = await notifyShopAnnouncement(ctx.businessId, alertUrls);
  if (sent == null) {
    return {
      error: null,
      pushNote: 'Saved. The phone alert could not be sent. Check that the push function is deployed.',
    };
  }
  const posterLabel = `${alertUrls.length} poster${alertUrls.length === 1 ? '' : 's'}`;
  return {
    error: null,
    pushNote: `Saved. Phone alert sent for ${posterLabel} to ${sent} device${sent === 1 ? '' : 's'}.`,
  };
}
