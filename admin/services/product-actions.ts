'use server';

import { revalidatePath } from 'next/cache';

import { notifyProductAvailablePush } from '@/lib/product-status-push';
import { isSupabaseConfigured } from '@/config/env';
import { logAdminAudit } from '@/services/admin-audit';
import { createServerSupabaseClient } from '@/services/supabase/server';
import { parseStockInput } from '@/lib/stock';
import { MAX_IMAGE_BYTES, uploadProductImageBytes } from '@/services/storage';

const NAME_MAX = 120;
const DESCRIPTION_MAX = 500;
const PRICE_MAX = 9_999_999.99;
const MAX_CSV_CHARS = 1_000_000;
const MAX_IMPORT_ROWS = 250;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    data: { user },
  } = await supabase.auth.getUser();
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

function parsePrice(raw: string): number | null {
  const price = Number(raw.trim());
  if (!Number.isFinite(price) || price < 0 || price > PRICE_MAX) {
    return null;
  }
  return Math.round(price * 100) / 100;
}

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export async function updateProductAvailability(
  productId: string,
  available: boolean,
): Promise<{ error: string | null }> {
  if (!isUuid(productId) || typeof available !== 'boolean') {
    return { error: 'Could not update this product.' };
  }
  const ctx = await requireAdmin();
  if ('error' in ctx) {
    return { error: ctx.error };
  }
  if (available) {
    const { data: current } = await ctx.supabase
      .from('products')
      .select('stock_qty')
      .eq('id', productId)
      .eq('business_id', ctx.businessId)
      .maybeSingle();
    if (current && current.stock_qty === 0) {
      return { error: 'Set available stock first. 0 remaining means this item is sold out.' };
    }
  }
  const { data, error } = await ctx.supabase
    .from('products')
    .update({ available })
    .eq('id', productId)
    .eq('business_id', ctx.businessId)
    .select('id, name')
    .maybeSingle();
  if (error || !data) {
    return { error: 'Could not update this product.' };
  }
  if (available) {
    const {
      data: { session },
    } = await ctx.supabase.auth.getSession();
    await notifyProductAvailablePush(productId, session?.access_token);
  }
  await logAdminAudit(auditCtx(ctx), {
    action: 'product.availability',
    entityType: 'product',
    entityId: productId,
    summary: `${data.name} marked ${available ? 'available' : 'unavailable'}`,
  });
  revalidatePath('/products');
  revalidatePath(`/products/${productId}`);
  return { error: null };
}

export async function updateProductActive(
  productId: string,
  active: boolean,
): Promise<{ error: string | null }> {
  if (!isUuid(productId) || typeof active !== 'boolean') {
    return { error: 'Could not update this product.' };
  }
  const ctx = await requireAdmin();
  if ('error' in ctx) {
    return { error: ctx.error };
  }
  const { data, error } = await ctx.supabase
    .from('products')
    .update({ active })
    .eq('id', productId)
    .eq('business_id', ctx.businessId)
    .select('id, name')
    .maybeSingle();
  if (error || !data) {
    if (error?.message?.includes('schema cache') || error?.code === 'PGRST204' || error?.code === 'PGRST205') {
      return {
        error:
          'Product Active is not in this database yet. In the SQL editor, run supabase/migrations/20260926140000_product_active.sql, then try again.',
      };
    }
    return { error: 'Could not update this product.' };
  }
  await logAdminAudit(auditCtx(ctx), {
    action: 'product.active',
    entityType: 'product',
    entityId: productId,
    summary: `${data.name} set ${active ? 'active' : 'inactive'}`,
  });
  revalidatePath('/products');
  return { error: null };
}

export async function deleteProduct(productId: string): Promise<{ error: string | null }> {
  if (!isUuid(productId)) {
    return { error: 'Could not delete this product.' };
  }
  const ctx = await requireAdmin();
  if ('error' in ctx) {
    return { error: ctx.error };
  }

  const { data: product } = await ctx.supabase
    .from('products')
    .select('id, image_url, name')
    .eq('id', productId)
    .eq('business_id', ctx.businessId)
    .maybeSingle();
  if (!product) {
    return { error: 'Could not delete this product.' };
  }

  const { count, error: usedError } = await ctx.supabase
    .from('order_items')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId);
  if (usedError) {
    return { error: 'Could not delete this product.' };
  }
  if ((count ?? 0) > 0) {
    return { error: 'This product is in existing orders. Set it inactive instead of deleting.' };
  }

  const { error } = await ctx.supabase
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('business_id', ctx.businessId);
  if (error) {
    return { error: 'Could not delete this product.' };
  }
  await logAdminAudit(auditCtx(ctx), {
    action: 'product.delete',
    entityType: 'product',
    entityId: productId,
    summary: `Deleted product ${product.name}`,
  });
  revalidatePath('/products');
  revalidatePath(`/products/${productId}`);
  return { error: null };
}

export async function saveProduct(formData: FormData): Promise<{ error: string | null }> {
  const ctx = await requireAdmin();
  if ('error' in ctx) {
    return { error: ctx.error };
  }

  const idRaw = String(formData.get('id') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim().slice(0, DESCRIPTION_MAX);
  const sellingTypeRaw = String(formData.get('selling_type') ?? 'quantity').trim();
  const sellingType =
    sellingTypeRaw === 'kg' || sellingTypeRaw === 'liter' || sellingTypeRaw === 'fixed_pack'
      ? sellingTypeRaw
      : 'quantity';
  const price = parsePrice(String(formData.get('price') ?? ''));
  const weightsRaw = String(formData.get('weights') ?? '').trim();
  const volumesRaw = String(formData.get('volumes') ?? '').trim();
  const packsRaw = String(formData.get('packs') ?? '').trim();
  const categoryRaw = String(formData.get('category_id') ?? '').trim();
  const stockParsed = parseStockInput(String(formData.get('stock_qty') ?? ''), sellingType);
  if (!stockParsed.ok) {
    return {
      error:
        sellingType === 'kg'
          ? 'Available stock must be kilograms (for example 1 or 0.5), or blank for unlimited.'
          : sellingType === 'liter'
            ? 'Available stock must be liters, or blank for unlimited.'
            : 'Available stock must be a whole number, or blank for unlimited.',
    };
  }
  const imageRemoved = formData.get('image_removed') === '1';
  const image = formData.get('image');
  const imageBlob =
    image instanceof Blob && image.size > 0 ? image : null;

  if (!name || name.length > NAME_MAX) {
    return { error: 'Enter a product name up to 120 characters.' };
  }
  let unitPrice = price;
  if (sellingType !== 'fixed_pack' && unitPrice == null) {
    return {
      error:
        sellingType === 'kg'
          ? 'Enter a valid price per Kg.'
          : sellingType === 'liter'
            ? 'Enter a valid price per Liter.'
            : 'Enter a valid price.',
    };
  }
  type WeightInput = {
    id?: string;
    weight_grams: number;
    is_active: boolean;
    display_order: number;
  };
  let weights: WeightInput[] = [];
  if (sellingType === 'kg') {
    try {
      const parsed = JSON.parse(weightsRaw || '[]') as WeightInput[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return { error: 'Add at least one weight option.' };
      }
      weights = parsed.map((row, index) => ({
        id: typeof row.id === 'string' && isUuid(row.id) ? row.id : undefined,
        weight_grams: Number(row.weight_grams),
        is_active: row.is_active !== false,
        display_order: Number(row.display_order) || index,
      }));
      if (weights.some((row) => !Number.isInteger(row.weight_grams) || row.weight_grams < 1 || row.weight_grams > 100_000)) {
        return { error: 'Each weight must be a whole number of grams between 1 and 100000.' };
      }
      const grams = weights.map((row) => row.weight_grams);
      if (new Set(grams).size !== grams.length) {
        return { error: 'Each weight option must be unique.' };
      }
      if (!weights.some((row) => row.is_active)) {
        return { error: 'Keep at least one weight option active.' };
      }
    } catch {
      return { error: 'Could not save weight options.' };
    }
  }
  type VolumeInput = {
    id?: string;
    volume_ml: number;
    is_active: boolean;
    display_order: number;
  };
  let volumes: VolumeInput[] = [];
  if (sellingType === 'liter') {
    try {
      const parsed = JSON.parse(volumesRaw || '[]') as VolumeInput[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return { error: 'Add at least one volume option.' };
      }
      volumes = parsed.map((row, index) => ({
        id: typeof row.id === 'string' && isUuid(row.id) ? row.id : undefined,
        volume_ml: Number(row.volume_ml),
        is_active: row.is_active !== false,
        display_order: Number(row.display_order) || index,
      }));
      if (volumes.some((row) => !Number.isInteger(row.volume_ml) || row.volume_ml < 1 || row.volume_ml > 100_000)) {
        return { error: 'Each volume must be a whole number of ml between 1 and 100000.' };
      }
      const mls = volumes.map((row) => row.volume_ml);
      if (new Set(mls).size !== mls.length) {
        return { error: 'Each volume option must be unique.' };
      }
      if (!volumes.some((row) => row.is_active)) {
        return { error: 'Keep at least one volume option active.' };
      }
    } catch {
      return { error: 'Could not save volume options.' };
    }
  }
  type PackInput = {
    id?: string;
    weight_grams: number;
    selling_price: number;
    is_active: boolean;
    display_order: number;
  };
  let packs: PackInput[] = [];
  if (sellingType === 'fixed_pack') {
    try {
      const parsed = JSON.parse(packsRaw || '[]') as PackInput[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return { error: 'Add at least one pack option.' };
      }
      packs = parsed.map((row, index) => ({
        id: typeof row.id === 'string' && isUuid(row.id) ? row.id : undefined,
        weight_grams: Number(row.weight_grams),
        selling_price: Number(row.selling_price),
        is_active: row.is_active !== false,
        display_order: Number(row.display_order) || index,
      }));
      if (packs.some((row) => !Number.isInteger(row.weight_grams) || row.weight_grams < 1)) {
        return { error: 'Pack weight must be a whole number of grams.' };
      }
      if (packs.some((row) => !Number.isFinite(row.selling_price) || row.selling_price < 0)) {
        return { error: 'Each pack needs a selling price of 0 or more.' };
      }
      const weights = packs.map((row) => row.weight_grams);
      if (new Set(weights).size !== weights.length) {
        return { error: 'Each pack weight must be unique.' };
      }
      if (!packs.some((row) => row.is_active)) {
        return { error: 'Keep at least one pack option active.' };
      }
      if (unitPrice == null) {
        unitPrice = packs.find((row) => row.is_active)?.selling_price ?? packs[0]?.selling_price ?? null;
      }
      if (unitPrice == null) {
        return { error: 'Each pack needs a selling price of 0 or more.' };
      }
    } catch {
      return { error: 'Could not save pack options.' };
    }
  }
  if (idRaw && !isUuid(idRaw)) {
    return { error: 'Could not save the product.' };
  }
  if (categoryRaw && !isUuid(categoryRaw)) {
    return { error: 'Choose a valid category.' };
  }

  let existing: { id: string; image_url: string | null } | null = null;
  if (idRaw) {
    const { data } = await ctx.supabase
      .from('products')
      .select('id, image_url')
      .eq('id', idRaw)
      .eq('business_id', ctx.businessId)
      .maybeSingle();
    if (!data) {
      return { error: 'Could not save the product.' };
    }
    existing = data;
  }

  const { data: businessRow } = await ctx.supabase
    .from('businesses')
    .select('categories_enabled')
    .eq('id', ctx.businessId)
    .maybeSingle();
  const categoriesEnabled = Boolean((businessRow as { categories_enabled?: boolean } | null)?.categories_enabled);

  let categoryId: string | null = null;
  if (categoriesEnabled && categoryRaw) {
    const { data: category } = await ctx.supabase
      .from('product_categories')
      .select('id')
      .eq('id', categoryRaw)
      .eq('business_id', ctx.businessId)
      .maybeSingle();
    if (!category) {
      return { error: 'Choose a valid category.' };
    }
    categoryId = category.id;
  }

  let imageUrl = imageRemoved ? null : (existing?.image_url ?? null);
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

  const payload = {
    name,
    description,
    price: unitPrice,
    selling_type: sellingType,
    selling_unit: sellingType === 'kg' ? 'Kg' : sellingType === 'liter' ? 'L' : sellingType === 'fixed_pack' ? 'pack' : null,
    price_per_kg: sellingType === 'kg' ? unitPrice : null,
    price_per_liter: sellingType === 'liter' ? unitPrice : null,
    minimum_weight_grams: null,
    maximum_weight_grams: null,
    image_url: imageUrl,
    business_id: ctx.businessId,
    stock_qty: stockParsed.value,
    ...(existing ? {} : { available: stockParsed.value === 0 ? false : true, active: true }),
    ...(stockParsed.value === 0 ? { available: false } : {}),
    ...(categoriesEnabled ? { category_id: categoryId } : {}),
  };

  let savedId = existing?.id;
  if (existing) {
    const { error } = await ctx.supabase
      .from('products')
      .update(payload)
      .eq('id', existing.id)
      .eq('business_id', ctx.businessId);
    if (error) {
      return { error: 'Could not save the product.' };
    }
  } else {
    const { data, error } = await ctx.supabase.from('products').insert(payload).select('id').maybeSingle();
    if (error || !data) {
      return { error: 'Could not save the product.' };
    }
    savedId = data.id;
  }

  if (savedId && sellingType === 'fixed_pack') {
    const { data: allPacks } = await ctx.supabase
      .from('product_pack_options')
      .select('id, weight_grams')
      .eq('product_id', savedId);
    const knownIds = new Set((allPacks ?? []).map((row) => row.id));
    const byWeight = new Map((allPacks ?? []).map((row) => [row.weight_grams, row.id]));
    const keepIds = new Set<string>();
    for (const pack of packs) {
      const existingId =
        (pack.id && knownIds.has(pack.id) ? pack.id : undefined) ?? byWeight.get(pack.weight_grams);
      if (existingId) {
        const { error: packError } = await ctx.supabase
          .from('product_pack_options')
          .update({
            weight_grams: pack.weight_grams,
            selling_price: pack.selling_price,
            is_active: pack.is_active,
            display_order: pack.display_order,
          })
          .eq('id', existingId)
          .eq('product_id', savedId);
        if (packError) {
          return { error: packError.message || 'Could not save pack options.' };
        }
        keepIds.add(existingId);
      } else {
        const { error: packError } = await ctx.supabase.from('product_pack_options').insert({
          product_id: savedId,
          weight_grams: pack.weight_grams,
          selling_price: pack.selling_price,
          is_active: pack.is_active,
          display_order: pack.display_order,
        });
        if (packError) {
          return { error: packError.message || 'Could not save pack options.' };
        }
      }
    }
    for (const row of allPacks ?? []) {
      if (!keepIds.has(row.id)) {
        await ctx.supabase
          .from('product_pack_options')
          .update({ is_active: false })
          .eq('id', row.id)
          .eq('product_id', savedId);
      }
    }
  }

  if (savedId && sellingType === 'liter') {
    const { data: allVolumes } = await ctx.supabase
      .from('product_volume_options')
      .select('id, volume_ml')
      .eq('product_id', savedId);
    const knownIds = new Set((allVolumes ?? []).map((row) => row.id));
    const byMl = new Map((allVolumes ?? []).map((row) => [row.volume_ml, row.id]));
    const keepIds = new Set<string>();
    for (const row of volumes) {
      const existingId = (row.id && knownIds.has(row.id) ? row.id : undefined) ?? byMl.get(row.volume_ml);
      if (existingId) {
        const { error: volumeError } = await ctx.supabase
          .from('product_volume_options')
          .update({
            volume_ml: row.volume_ml,
            is_active: row.is_active,
            display_order: row.display_order,
          })
          .eq('id', existingId)
          .eq('product_id', savedId);
        if (volumeError) {
          return { error: volumeError.message || 'Could not save volume options.' };
        }
        keepIds.add(existingId);
      } else {
        const { error: volumeError } = await ctx.supabase.from('product_volume_options').insert({
          product_id: savedId,
          volume_ml: row.volume_ml,
          is_active: row.is_active,
          display_order: row.display_order,
        });
        if (volumeError) {
          return { error: volumeError.message || 'Could not save volume options.' };
        }
      }
    }
    for (const row of allVolumes ?? []) {
      if (!keepIds.has(row.id)) {
        await ctx.supabase
          .from('product_volume_options')
          .update({ is_active: false })
          .eq('id', row.id)
          .eq('product_id', savedId);
      }
    }
  }

  if (savedId && sellingType === 'kg') {
    const { data: allWeights } = await ctx.supabase
      .from('product_weight_options')
      .select('id, weight_grams')
      .eq('product_id', savedId);
    const knownIds = new Set((allWeights ?? []).map((row) => row.id));
    const byGrams = new Map((allWeights ?? []).map((row) => [row.weight_grams, row.id]));
    const keepIds = new Set<string>();
    for (const row of weights) {
      const existingId = (row.id && knownIds.has(row.id) ? row.id : undefined) ?? byGrams.get(row.weight_grams);
      if (existingId) {
        const { error: weightError } = await ctx.supabase
          .from('product_weight_options')
          .update({
            weight_grams: row.weight_grams,
            is_active: row.is_active,
            display_order: row.display_order,
          })
          .eq('id', existingId)
          .eq('product_id', savedId);
        if (weightError) {
          return { error: weightError.message || 'Could not save weight options.' };
        }
        keepIds.add(existingId);
      } else {
        const { error: weightError } = await ctx.supabase.from('product_weight_options').insert({
          product_id: savedId,
          weight_grams: row.weight_grams,
          is_active: row.is_active,
          display_order: row.display_order,
        });
        if (weightError) {
          return { error: weightError.message || 'Could not save weight options.' };
        }
      }
    }
    for (const row of allWeights ?? []) {
      if (!keepIds.has(row.id)) {
        await ctx.supabase
          .from('product_weight_options')
          .update({ is_active: false })
          .eq('id', row.id)
          .eq('product_id', savedId);
      }
    }
  }

  await logAdminAudit(auditCtx(ctx), {
    action: existing ? 'product.update' : 'product.create',
    entityType: 'product',
    entityId: savedId ?? null,
    summary: existing ? `Updated product ${name}` : `Added product ${name}`,
  });

  revalidatePath('/products');
  revalidatePath('/');
  return { error: null };
}

export type ProductImportIssue = {
  row: number;
  field: string;
  message: string;
};

export type ProductImportResult = {
  created: number;
  skipped: number;
  errors: ProductImportIssue[];
  errorLogCsv: string | null;
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const source = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      if (row.some((value) => value.trim().length > 0)) {
        rows.push(row);
      }
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim().length > 0)) {
    rows.push(row);
  }
  return rows;
}

function headerIndex(headers: string[], name: string) {
  return headers.findIndex((header) => header.trim().toLowerCase() === name);
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function parseAvailable(value: string): { ok: true; available: boolean } | { ok: false } {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'yes') {
    return { ok: true, available: true };
  }
  if (normalized === 'no') {
    return { ok: true, available: false };
  }
  return { ok: false };
}

async function readCsvText(formData: FormData): Promise<string | null> {
  const csv = formData.get('csv');
  if (typeof csv === 'string' && csv.trim().length > 0) {
    return csv;
  }
  const file = formData.get('file');
  if (!file || typeof file === 'string' || !('size' in file) || file.size === 0) {
    return null;
  }
  if (typeof (file as Blob).text !== 'function') {
    return null;
  }
  const text = await (file as Blob).text();
  return text.trim().length > 0 ? text : null;
}

function imageExtensionOk(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return ['.png', '.webp', '.gif', '.jpg', '.jpeg'].some((ext) => lower.endsWith(ext));
}

async function resolveSafeHomeFile(
  imagePathRaw: string,
  home: string,
): Promise<{ ok: true; path: string } | { ok: false; message: string }> {
  const { promises: fs } = await import('node:fs');
  const path = await import('node:path');

  if (imagePathRaw.includes('\0')) {
    return { ok: false, message: 'Invalid image path.' };
  }
  const expanded = imagePathRaw.startsWith('~/') || imagePathRaw === '~' ? imagePathRaw.replace(/^~/, home) : imagePathRaw;
  const resolved = path.resolve(expanded);
  const homeResolved = path.resolve(home);
  const homePrefix = homeResolved.endsWith(path.sep) ? homeResolved : `${homeResolved}${path.sep}`;
  if (resolved !== homeResolved && !resolved.startsWith(homePrefix)) {
    return { ok: false, message: 'image_path must be under your home folder.' };
  }
  if (!imageExtensionOk(resolved)) {
    return { ok: false, message: 'Image must be JPG, PNG, WebP, or GIF.' };
  }

  let real: string;
  try {
    real = await fs.realpath(resolved);
  } catch {
    return { ok: false, message: 'Could not read this image file.' };
  }
  let realHome = homeResolved;
  try {
    realHome = await fs.realpath(homeResolved);
  } catch {
    realHome = homeResolved;
  }
  const realPrefix = realHome.endsWith(path.sep) ? realHome : `${realHome}${path.sep}`;
  if (real !== realHome && !real.startsWith(realPrefix)) {
    return { ok: false, message: 'image_path must be under your home folder.' };
  }
  return { ok: true, path: real };
}

export async function importProductsFromCsv(formData: FormData): Promise<ProductImportResult> {
  const { promises: fs } = await import('node:fs');
  const os = await import('node:os');

  const ctx = await requireAdmin();
  if ('error' in ctx) {
    return { created: 0, skipped: 0, errors: [{ row: 0, field: 'file', message: ctx.error }], errorLogCsv: null };
  }

  const csvText = await readCsvText(formData);
  if (!csvText) {
    return { created: 0, skipped: 0, errors: [{ row: 0, field: 'file', message: 'Choose a filled CSV file.' }], errorLogCsv: null };
  }
  if (csvText.length > MAX_CSV_CHARS) {
    return {
      created: 0,
      skipped: 0,
      errors: [{ row: 0, field: 'file', message: 'CSV is too large. Use 1 MB or less.' }],
      errorLogCsv: null,
    };
  }

  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    return {
      created: 0,
      skipped: 0,
      errors: [{ row: 0, field: 'file', message: 'CSV needs a header row and at least one product.' }],
      errorLogCsv: null,
    };
  }
  if (rows.length - 1 > MAX_IMPORT_ROWS) {
    return {
      created: 0,
      skipped: 0,
      errors: [{ row: 0, field: 'file', message: `Import at most ${MAX_IMPORT_ROWS} products at a time.` }],
      errorLogCsv: null,
    };
  }

  const headers = rows[0].map((value) => value.trim().toLowerCase());
  const nameIdx = headerIndex(headers, 'name');
  const descriptionIdx = headerIndex(headers, 'description');
  const priceIdx = headerIndex(headers, 'price');
  const availableIdx = headerIndex(headers, 'available');
  const activeIdx = headerIndex(headers, 'active');
  const imageIdx = headerIndex(headers, 'image_path');
  const categoryIdx = headerIndex(headers, 'category');

  if (nameIdx < 0 || descriptionIdx < 0 || priceIdx < 0 || imageIdx < 0) {
    return {
      created: 0,
      skipped: 0,
      errors: [
        {
          row: 1,
          field: 'header',
          message: 'CSV must include name, description, price, and image_path columns.',
        },
      ],
      errorLogCsv: null,
    };
  }

  const { data: businessRow } = await ctx.supabase
    .from('businesses')
    .select('categories_enabled')
    .eq('id', ctx.businessId)
    .maybeSingle();
  const categoriesEnabled = Boolean((businessRow as { categories_enabled?: boolean } | null)?.categories_enabled);
  const categoryByName = new Map<string, string>();
  if (categoriesEnabled) {
    const { data: categoryRows } = await ctx.supabase
      .from('product_categories')
      .select('id, name')
      .eq('business_id', ctx.businessId)
      .eq('active', true);
    for (const row of categoryRows ?? []) {
      categoryByName.set((row.name as string).trim().toLowerCase(), row.id as string);
    }
  }

  const home = os.homedir();
  const errors: ProductImportIssue[] = [];
  let created = 0;
  let skipped = 0;

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const line = i + 1;
    const rowErrors: ProductImportIssue[] = [];
    const name = (row[nameIdx] ?? '').trim();
    const description = (row[descriptionIdx] ?? '').trim().slice(0, DESCRIPTION_MAX);
    const priceRaw = (row[priceIdx] ?? '').trim();
    const availableRaw = availableIdx >= 0 ? (row[availableIdx] ?? '').trim() : '';
    const activeRaw = activeIdx >= 0 ? (row[activeIdx] ?? '').trim() : '';
    const imagePathRaw = (row[imageIdx] ?? '').trim();
    const categoryRaw = categoryIdx >= 0 ? (row[categoryIdx] ?? '').trim() : '';
    const price = parsePrice(priceRaw);
    const availableParsed = availableRaw ? parseAvailable(availableRaw) : { ok: true as const, available: true };
    const activeParsed = activeRaw ? parseAvailable(activeRaw) : { ok: true as const, available: true };

    if (!name) {
      rowErrors.push({ row: line, field: 'name', message: 'Name is required.' });
    } else if (name.length > NAME_MAX) {
      rowErrors.push({ row: line, field: 'name', message: 'Name must be 120 characters or less.' });
    }
    if (!description) {
      rowErrors.push({ row: line, field: 'description', message: 'Description is required.' });
    }
    if (!priceRaw || price == null) {
      rowErrors.push({ row: line, field: 'price', message: 'Price must be a number 0 or more.' });
    }
    if (availableRaw && !availableParsed.ok) {
      rowErrors.push({ row: line, field: 'available', message: 'Available must be Yes or No when provided.' });
    }
    if (activeRaw && !activeParsed.ok) {
      rowErrors.push({ row: line, field: 'active', message: 'Active must be Yes or No when provided.' });
    }
    if (!imagePathRaw) {
      rowErrors.push({ row: line, field: 'image_path', message: 'image_path is required.' });
    }

    let safePath = '';
    if (imagePathRaw) {
      const resolved = await resolveSafeHomeFile(imagePathRaw, home);
      if (!resolved.ok) {
        rowErrors.push({ row: line, field: 'image_path', message: resolved.message });
      } else {
        safePath = resolved.path;
      }
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      skipped += 1;
      continue;
    }

    let categoryId: string | null = null;
    if (categoryRaw) {
      if (!categoriesEnabled) {
        errors.push({ row: line, field: 'category', message: 'Enable Categories before importing category values.' });
        skipped += 1;
        continue;
      }
      categoryId = categoryByName.get(categoryRaw.toLowerCase()) ?? null;
      if (!categoryId) {
        errors.push({
          row: line,
          field: 'category',
          message: `Unknown category "${categoryRaw.slice(0, 80)}". Use an active category name.`,
        });
        skipped += 1;
        continue;
      }
    }

    let bytes: Buffer;
    try {
      const stat = await fs.stat(safePath);
      if (!stat.isFile() || stat.size > MAX_IMAGE_BYTES) {
        errors.push({ row: line, field: 'image_path', message: 'Image must be a file of 5 MB or smaller.' });
        skipped += 1;
        continue;
      }
      bytes = await fs.readFile(safePath);
    } catch {
      errors.push({ row: line, field: 'image_path', message: 'Could not read this image file.' });
      skipped += 1;
      continue;
    }

    let imageUrl: string;
    try {
      imageUrl = await uploadProductImageBytes(ctx.supabase, ctx.businessId, bytes);
    } catch (uploadError) {
      errors.push({
        row: line,
        field: 'image_path',
        message: uploadError instanceof Error ? uploadError.message : 'Could not upload the image.',
      });
      skipped += 1;
      continue;
    }

    const { error } = await ctx.supabase.from('products').insert({
      name,
      description,
      price,
      available: availableParsed.ok ? availableParsed.available : true,
      active: activeParsed.ok ? activeParsed.available : true,
      business_id: ctx.businessId,
      image_url: imageUrl,
      ...(categoriesEnabled && categoryId ? { category_id: categoryId } : {}),
    });

    if (error) {
      errors.push({ row: line, field: 'save', message: 'Could not save this product.' });
      skipped += 1;
      continue;
    }
    created += 1;
  }

  if (created > 0) {
    await logAdminAudit(auditCtx(ctx), {
      action: 'import.products_csv',
      entityType: 'import',
      summary: `Imported ${created} product${created === 1 ? '' : 's'} from CSV`,
      details: { created, skipped },
    });
    revalidatePath('/');
    revalidatePath('/products');
  }

  if (created === 0 && skipped > 0) {
    errors.unshift({
      row: 0,
      field: 'file',
      message:
        skipped === 1
          ? 'No products imported. That row was skipped.'
          : `No products imported. All ${skipped} rows were skipped.`,
    });
  }

  const errorLogCsv =
    errors.filter((item) => item.row > 0).length === 0
      ? null
      : ['row,field,error']
          .concat(
            errors
              .filter((item) => item.row > 0)
              .map((item) => [String(item.row), item.field, item.message].map(csvEscape).join(',')),
          )
          .join('\n');

  return { created, skipped, errors, errorLogCsv };
}
