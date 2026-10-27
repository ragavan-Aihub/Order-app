'use server';

import { revalidatePath } from 'next/cache';

import { isSupabaseConfigured } from '@/config/env';
import { logAdminAudit } from '@/services/admin-audit';
import { MAX_IMAGE_BYTES, uploadProductImageBytes } from '@/services/storage';
import { createServerSupabaseClient } from '@/services/supabase/server';

type AdminContext = {
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>;
  businessId: string;
  adminUserId: string;
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
  return { supabase, businessId: profile.business_id, adminUserId: user.id };
}

function auditCtx(ctx: AdminContext) {
  return { supabase: ctx.supabase, businessId: ctx.businessId, adminUserId: ctx.adminUserId };
}

function revalidateCategories() {
  revalidatePath('/products/categories');
  revalidatePath('/products');
}

async function requireCategoriesEnabled(ctx: AdminContext): Promise<string | null> {
  const { data, error } = await ctx.supabase
    .from('businesses')
    .select('categories_enabled')
    .eq('id', ctx.businessId)
    .maybeSingle();
  if (error || !(data as { categories_enabled?: boolean } | null)?.categories_enabled) {
    return 'Enable Categories from Products → Categories first.';
  }
  return null;
}

export async function setCategoriesEnabled(enabled: boolean): Promise<{ error: string | null }> {
  const ctx = await requireAdmin();
  if ('error' in ctx) {
    return { error: ctx.error };
  }
  const { error } = await ctx.supabase
    .from('businesses')
    .update({ categories_enabled: enabled })
    .eq('id', ctx.businessId);
  if (error) {
    if (error.message.includes('schema cache') || error.code === 'PGRST204' || error.code === 'PGRST205') {
      return {
        error:
          'Category enable is not in this database yet. In the SQL editor, run supabase/migrations/20260925100000_product_categories.sql, then try again.',
      };
    }
    return { error: error.message };
  }
  await logAdminAudit(auditCtx(ctx), {
    action: 'category.feature_toggle',
    entityType: 'business',
    entityId: ctx.businessId,
    summary: enabled ? 'Product categories enabled' : 'Product categories disabled',
  });
  revalidateCategories();
  return { error: null };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function saveCategory(formData: FormData): Promise<{ error: string | null; id?: string }> {
  const ctx = await requireAdmin();
  if ('error' in ctx) {
    return { error: ctx.error };
  }
  const gated = await requireCategoriesEnabled(ctx);
  if (gated) {
    return { error: gated };
  }
  const idRaw = String(formData.get('id') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const imageRemoved = formData.get('image_removed') === '1';
  const image = formData.get('image');
  const imageBlob = image instanceof Blob && image.size > 0 ? image : null;
  if (name.length < 2) {
    return { error: 'Enter a category name.' };
  }
  if (idRaw && !isUuid(idRaw)) {
    return { error: 'Could not save the category.' };
  }

  let existing: { id: string; image_url: string | null } | null = null;
  if (idRaw) {
    const { data } = await ctx.supabase
      .from('product_categories')
      .select('id, image_url')
      .eq('id', idRaw)
      .eq('business_id', ctx.businessId)
      .maybeSingle();
    if (!data) {
      return { error: 'Could not save the category.' };
    }
    existing = data as { id: string; image_url: string | null };
  }

  let imageUrl = imageRemoved ? null : (existing?.image_url ?? null);
  if (!existing && !imageBlob) {
    return { error: 'Add a category image.' };
  }
  if (imageBlob) {
    if (imageBlob.size > MAX_IMAGE_BYTES) {
      return { error: 'Image must be 5 MB or smaller.' };
    }
    try {
      const bytes = Buffer.from(await imageBlob.arrayBuffer());
      imageUrl = await uploadProductImageBytes(ctx.supabase, ctx.businessId, bytes);
    } catch (uploadError) {
      return { error: uploadError instanceof Error ? uploadError.message : 'Could not upload the image.' };
    }
  }

  const result = existing
    ? await ctx.supabase
        .from('product_categories')
        .update({ name, image_url: imageUrl })
        .eq('id', existing.id)
        .eq('business_id', ctx.businessId)
        .select('id')
        .maybeSingle()
    : await ctx.supabase
        .from('product_categories')
        .insert({ business_id: ctx.businessId, name, active: true, image_url: imageUrl })
        .select('id')
        .maybeSingle();

  if (result.error || !result.data) {
    if (result.error?.code === '23505') {
      return { error: 'A category with this name already exists.' };
    }
    if (result.error?.message?.includes('schema cache') || result.error?.code === 'PGRST204' || result.error?.code === 'PGRST205') {
      return {
        error:
          'Category images are not in this database yet. In the SQL editor, run supabase/migrations/20260926130000_category_images.sql, then try again.',
      };
    }
    return { error: result.error?.message ?? 'Could not save the category.' };
  }

  await logAdminAudit(auditCtx(ctx), {
    action: existing ? 'category.update' : 'category.create',
    entityType: 'category',
    entityId: result.data.id,
    summary: existing ? `Updated category ${name}` : `Added category ${name}`,
  });
  revalidateCategories();
  return { error: null, id: result.data.id };
}

export async function setCategoryActive(input: {
  id: string;
  active: boolean;
}): Promise<{ error: string | null }> {
  const ctx = await requireAdmin();
  if ('error' in ctx) {
    return { error: ctx.error };
  }
  const gated = await requireCategoriesEnabled(ctx);
  if (gated) {
    return { error: gated };
  }
  const { data, error } = await ctx.supabase
    .from('product_categories')
    .update({ active: input.active })
    .eq('id', input.id)
    .eq('business_id', ctx.businessId)
    .select('id, name')
    .maybeSingle();
  if (error || !data) {
    return { error: error?.message ?? 'Could not update this category.' };
  }
  await logAdminAudit(auditCtx(ctx), {
    action: 'category.active',
    entityType: 'category',
    entityId: input.id,
    summary: `${data.name} set ${input.active ? 'active' : 'inactive'}`,
  });
  revalidateCategories();
  return { error: null };
}
