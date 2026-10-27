import * as FileSystem from 'expo-file-system/legacy';

const MAX_BYTES = 5 * 1024 * 1024;

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function bytesFromBase64(base64: string): Uint8Array {
  const trimmed = base64.replace(/^data:image\/\w+;base64,/, '');
  return base64ToUint8Array(trimmed);
}

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

export async function readImageBytesFromUri(uri: string): Promise<Uint8Array> {
  let bytes: Uint8Array;
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    bytes = base64ToUint8Array(base64);
  } catch {
    try {
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error('Could not read the image.');
      }
      const buffer = await response.arrayBuffer();
      bytes = new Uint8Array(buffer);
    } catch {
      throw new Error('Could not read the image. Try another photo or take a screenshot of the QR.');
    }
  }
  if (bytes.byteLength > MAX_BYTES) {
    throw new Error('Image must be 5 MB or smaller.');
  }
  const meta = sniffImage(bytes);
  if (!meta) {
    throw new Error('Use a JPG, PNG, or WebP image.');
  }
  return bytes;
}

export function imageMetaFromBytes(bytes: Uint8Array): { contentType: string; extension: string; bytes: Uint8Array } {
  if (bytes.byteLength > MAX_BYTES) {
    throw new Error('Image must be 5 MB or smaller.');
  }
  const meta = sniffImage(bytes);
  if (!meta) {
    throw new Error('Use a JPG, PNG, or WebP image.');
  }
  return { ...meta, bytes };
}
