import { getSupabaseClient } from '@/services/supabase';
import { bytesFromBase64, imageMetaFromBytes, readImageBytesFromUri } from '@/utils/image-upload';
import { prepareUpiQrBytes } from '@/utils/upi-qr-image';

const BUCKET = 'business-logos';

export async function getBusinessUpiQrUrl(businessId: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from('businesses')
    .select('upi_qr_url')
    .eq('id', businessId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const url = data?.upi_qr_url?.trim();
  return url || null;
}

export async function uploadBusinessUpiQrFromUri(businessId: string, localUri: string): Promise<string> {
  const bytes = await readImageBytesFromUri(localUri);
  return uploadBusinessUpiQrBytes(businessId, bytes);
}

export async function uploadBusinessUpiQrFromBase64(businessId: string, base64: string): Promise<string> {
  const bytes = bytesFromBase64(base64);
  return uploadBusinessUpiQrBytes(businessId, bytes);
}

export async function uploadBusinessUpiQrFromPickerAsset(
  businessId: string,
  asset: { uri: string; width?: number; height?: number; base64?: string | null },
): Promise<string> {
  const bytes = await prepareUpiQrBytes(asset);
  return uploadBusinessUpiQrBytes(businessId, bytes);
}

export async function uploadBusinessUpiQrBytes(businessId: string, bytes: Uint8Array): Promise<string> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { contentType, extension, bytes: payload } = imageMetaFromBytes(bytes);
  const objectPath = `${businessId}/upi-qr/qr.${extension}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(objectPath, payload, {
    contentType,
    cacheControl: '3600',
    upsert: true,
  });

  if (uploadError) {
    throw new Error(uploadError.message || 'Could not upload the QR image.');
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from('businesses')
    .update({ upi_qr_url: publicUrl })
    .eq('id', businessId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return publicUrl;
}
