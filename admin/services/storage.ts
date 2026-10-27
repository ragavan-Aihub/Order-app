import type { SupabaseClient } from '@supabase/supabase-js';

const PRODUCT_IMAGES_BUCKET = 'product-images';
const BUSINESS_LOGOS_BUCKET = 'business-logos';
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function sniffImage(bytes: Uint8Array): { contentType: string; extension: string } | null {
  if (bytes.length < 12) {
    return null;
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: 'image/jpeg', extension: 'jpg' };
  }
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { contentType: 'image/png', extension: 'png' };
  }
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return { contentType: 'image/gif', extension: 'gif' };
  }
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { contentType: 'image/webp', extension: 'webp' };
  }
  return null;
}

function asBytes(fileOrBuffer: File | Buffer | Uint8Array): Promise<Uint8Array> | Uint8Array {
  if (fileOrBuffer instanceof Uint8Array) {
    return fileOrBuffer;
  }
  if (typeof File !== 'undefined' && fileOrBuffer instanceof File) {
    return fileOrBuffer.arrayBuffer().then((buffer) => new Uint8Array(buffer));
  }
  return new Uint8Array(fileOrBuffer as unknown as ArrayBuffer);
}

async function uploadImageBytes(
  supabase: SupabaseClient,
  bucket: string,
  objectPath: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  const { error } = await supabase.storage.from(bucket).upload(objectPath, bytes, {
    contentType,
    cacheControl: '3600',
    upsert: false,
  });
  if (error) {
    throw new Error('Could not upload the image.');
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  return data.publicUrl;
}

async function prepareImage(bytes: Uint8Array): Promise<{ contentType: string; extension: string; bytes: Uint8Array }> {
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('Image must be 5 MB or smaller.');
  }
  const meta = sniffImage(bytes);
  if (!meta) {
    throw new Error('Use a JPG, PNG, WebP, or GIF image.');
  }
  return { ...meta, bytes };
}

export async function uploadProductImage(
  supabase: SupabaseClient,
  businessId: string,
  file: File,
): Promise<string> {
  const prepared = await prepareImage(await asBytes(file));
  return uploadImageBytes(
    supabase,
    PRODUCT_IMAGES_BUCKET,
    `${businessId}/${crypto.randomUUID()}.${prepared.extension}`,
    prepared.bytes,
    prepared.contentType,
  );
}

export async function uploadProductImageBytes(
  supabase: SupabaseClient,
  businessId: string,
  bytes: Buffer | Uint8Array,
): Promise<string> {
  const prepared = await prepareImage(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  return uploadImageBytes(
    supabase,
    PRODUCT_IMAGES_BUCKET,
    `${businessId}/${crypto.randomUUID()}.${prepared.extension}`,
    prepared.bytes,
    prepared.contentType,
  );
}

async function uploadBusinessAsset(
  supabase: SupabaseClient,
  businessId: string,
  file: File,
  kind: 'logo' | 'banner',
): Promise<string> {
  const prepared = await prepareImage(await asBytes(file));
  return uploadImageBytes(
    supabase,
    BUSINESS_LOGOS_BUCKET,
    `${businessId}/${kind}/${crypto.randomUUID()}.${prepared.extension}`,
    prepared.bytes,
    prepared.contentType,
  );
}

export async function uploadBusinessLogo(
  supabase: SupabaseClient,
  businessId: string,
  file: File,
): Promise<string> {
  return uploadBusinessAsset(supabase, businessId, file, 'logo');
}

export async function uploadBusinessBanner(
  supabase: SupabaseClient,
  businessId: string,
  file: File,
): Promise<string> {
  return uploadBusinessAsset(supabase, businessId, file, 'banner');
}
