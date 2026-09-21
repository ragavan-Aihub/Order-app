'use server';

import { isSupabaseConfigured } from '@/config/env';
import { createServerSupabaseClient } from '@/services/supabase/server';

export async function updateProductAvailability(
  productId: string,
  available: boolean,
): Promise<{ error: string | null }> {
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

  const { data, error } = await supabase
    .from('products')
    .update({ available })
    .eq('id', productId)
    .eq('business_id', profile.business_id)
    .select('id')
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }
  if (!data) {
    return { error: 'Could not update this product.' };
  }

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
  const normalized = value.trim();
  if (normalized === 'Yes') {
    return { ok: true, available: true };
  }
  if (normalized === 'No') {
    return { ok: true, available: false };
  }
  return { ok: false };
}

function imageMeta(filePath: string): { contentType: string; extension: string } | null {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.png')) {
    return { contentType: 'image/png', extension: 'png' };
  }
  if (lower.endsWith('.webp')) {
    return { contentType: 'image/webp', extension: 'webp' };
  }
  if (lower.endsWith('.gif')) {
    return { contentType: 'image/gif', extension: 'gif' };
  }
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return { contentType: 'image/jpeg', extension: 'jpg' };
  }
  return null;
}

export async function importProductsFromCsv(formData: FormData): Promise<ProductImportResult> {
  const { promises: fs } = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');

  if (!isSupabaseConfigured) {
    return { created: 0, skipped: 0, errors: [{ row: 0, field: 'file', message: 'Supabase is not configured.' }], errorLogCsv: null };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { created: 0, skipped: 0, errors: [{ row: 0, field: 'file', message: 'Supabase is not configured.' }], errorLogCsv: null };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { created: 0, skipped: 0, errors: [{ row: 0, field: 'file', message: 'You are not signed in as an admin.' }], errorLogCsv: null };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, business_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'admin' || !profile.business_id) {
    return { created: 0, skipped: 0, errors: [{ row: 0, field: 'file', message: 'You are not signed in as an admin.' }], errorLogCsv: null };
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { created: 0, skipped: 0, errors: [{ row: 0, field: 'file', message: 'Choose a filled CSV file.' }], errorLogCsv: null };
  }

  const rows = parseCsv(await file.text());
  if (rows.length < 2) {
    return {
      created: 0,
      skipped: 0,
      errors: [{ row: 0, field: 'file', message: 'CSV needs a header row and at least one product.' }],
      errorLogCsv: null,
    };
  }

  const headers = rows[0].map((value) => value.trim().toLowerCase());
  const nameIdx = headerIndex(headers, 'name');
  const descriptionIdx = headerIndex(headers, 'description');
  const priceIdx = headerIndex(headers, 'price');
  const availableIdx = headerIndex(headers, 'available');
  const imageIdx = headerIndex(headers, 'image_path');

  if (nameIdx < 0 || descriptionIdx < 0 || priceIdx < 0 || availableIdx < 0 || imageIdx < 0) {
    return {
      created: 0,
      skipped: 0,
      errors: [
        {
          row: 1,
          field: 'header',
          message: 'CSV must include name, description, price, available, and image_path columns.',
        },
      ],
      errorLogCsv: null,
    };
  }

  const home = os.homedir();
  const errors: ProductImportIssue[] = [];
  let created = 0;
  let skipped = 0;
  const { uploadProductImageBytes } = await import('@/services/storage');

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const line = i + 1;
    const rowErrors: ProductImportIssue[] = [];
    const name = (row[nameIdx] ?? '').trim();
    const description = (row[descriptionIdx] ?? '').trim();
    const priceRaw = (row[priceIdx] ?? '').trim();
    const availableRaw = (row[availableIdx] ?? '').trim();
    const imagePathRaw = (row[imageIdx] ?? '').trim();
    const price = Number(priceRaw);
    const availableParsed = parseAvailable(availableRaw);

    if (!name) {
      rowErrors.push({ row: line, field: 'name', message: 'Name is required.' });
    }
    if (!description) {
      rowErrors.push({ row: line, field: 'description', message: 'Description is required.' });
    }
    if (!priceRaw || !Number.isFinite(price) || price < 0) {
      rowErrors.push({ row: line, field: 'price', message: 'Price must be a number 0 or more.' });
    }
    if (!availableParsed.ok) {
      rowErrors.push({ row: line, field: 'available', message: 'Available must be exactly Yes or No.' });
    }
    if (!imagePathRaw) {
      rowErrors.push({ row: line, field: 'image_path', message: 'image_path is required.' });
    }

    let resolved = '';
    let meta: { contentType: string; extension: string } | null = null;
    if (imagePathRaw) {
      resolved = path.resolve(imagePathRaw.startsWith('~') ? imagePathRaw.replace(/^~/, home) : imagePathRaw);
      if (!resolved.startsWith(home + path.sep) && resolved !== home) {
        rowErrors.push({ row: line, field: 'image_path', message: 'image_path must be under your home folder.' });
      } else {
        meta = imageMeta(resolved);
        if (!meta) {
          rowErrors.push({ row: line, field: 'image_path', message: 'Image must be JPG, PNG, WebP, or GIF.' });
        }
      }
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      skipped += 1;
      continue;
    }

    let bytes: Buffer;
    try {
      bytes = await fs.readFile(resolved);
    } catch {
      errors.push({ row: line, field: 'image_path', message: `Could not read ${resolved}` });
      skipped += 1;
      continue;
    }

    let imageUrl: string;
    try {
      imageUrl = await uploadProductImageBytes(
        supabase,
        profile.business_id,
        bytes,
        meta!.contentType,
        meta!.extension,
      );
    } catch (uploadError) {
      errors.push({
        row: line,
        field: 'image_path',
        message: uploadError instanceof Error ? uploadError.message : 'Could not upload the image.',
      });
      skipped += 1;
      continue;
    }

    const { error } = await supabase.from('products').insert({
      name,
      description,
      price,
      available: availableParsed.ok ? availableParsed.available : true,
      business_id: profile.business_id,
      image_url: imageUrl,
    });

    if (error) {
      errors.push({ row: line, field: 'save', message: 'Could not save this product.' });
      skipped += 1;
      continue;
    }
    created += 1;
  }

  if (created > 0) {
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/');
    revalidatePath('/products');
  }

  const errorLogCsv =
    errors.length === 0
      ? null
      : ['row,field,error']
          .concat(errors.map((item) => [String(item.row), item.field, item.message].map(csvEscape).join(',')))
          .join('\n');

  return { created, skipped, errors, errorLogCsv };
}
