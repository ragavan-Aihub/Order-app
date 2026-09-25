'use server';

import { revalidatePath } from 'next/cache';

import { isSupabaseConfigured } from '@/config/env';
import { createServerSupabaseClient } from '@/services/supabase/server';

type AdminContext = {
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>;
  businessId: string;
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
  return { supabase, businessId: profile.business_id };
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
  revalidateCategories();
  return { error: null };
}

export async function saveCategory(input: {
  id?: string;
  name: string;
}): Promise<{ error: string | null; id?: string }> {
  const ctx = await requireAdmin();
  if ('error' in ctx) {
    return { error: ctx.error };
  }
  const gated = await requireCategoriesEnabled(ctx);
  if (gated) {
    return { error: gated };
  }
  const name = input.name.trim();
  if (name.length < 2) {
    return { error: 'Enter a category name.' };
  }

  const result = input.id
    ? await ctx.supabase
        .from('product_categories')
        .update({ name })
        .eq('id', input.id)
        .eq('business_id', ctx.businessId)
        .select('id')
        .maybeSingle()
    : await ctx.supabase
        .from('product_categories')
        .insert({ business_id: ctx.businessId, name, active: true })
        .select('id')
        .maybeSingle();

  if (result.error || !result.data) {
    if (result.error?.code === '23505') {
      return { error: 'A category with this name already exists.' };
    }
    if (result.error?.message?.includes('schema cache') || result.error?.code === 'PGRST205') {
      return {
        error:
          'Categories are not in this database yet. In the SQL editor, run supabase/migrations/20260925100000_product_categories.sql, then try again.',
      };
    }
    return { error: result.error?.message ?? 'Could not save the category.' };
  }

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
  const { error } = await ctx.supabase
    .from('product_categories')
    .update({ active: input.active })
    .eq('id', input.id)
    .eq('business_id', ctx.businessId);
  if (error) {
    return { error: error.message };
  }
  revalidateCategories();
  return { error: null };
}
