import * as ImageManipulator from 'expo-image-manipulator';

import { bytesFromBase64, readImageBytesFromUri } from '@/utils/image-upload';

const OUTPUT_SIZE = 512;

type PickerAsset = {
  uri: string;
  width?: number;
  height?: number;
  base64?: string | null;
};

/** Square crop (center), resize for scan-friendly UPI QR upload. */
export async function prepareUpiQrBytes(asset: PickerAsset): Promise<Uint8Array> {
  const width = asset.width ?? 0;
  const height = asset.height ?? 0;
  const actions: ImageManipulator.Action[] = [];

  if (width > 0 && height > 0) {
    const side = Math.min(width, height);
    const needsCrop = Math.abs(width - height) > 2;
    if (needsCrop) {
      actions.push({
        crop: {
          originX: Math.floor((width - side) / 2),
          originY: Math.floor((height - side) / 2),
          width: side,
          height: side,
        },
      });
    }
  }

  actions.push({ resize: { width: OUTPUT_SIZE, height: OUTPUT_SIZE } });

  const manipulated = await ImageManipulator.manipulateAsync(asset.uri, actions, {
    compress: 0.92,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });

  if (manipulated.base64) {
    return bytesFromBase64(manipulated.base64);
  }

  if (manipulated.uri) {
    return readImageBytesFromUri(manipulated.uri);
  }

  if (asset.base64) {
    return bytesFromBase64(asset.base64);
  }

  return readImageBytesFromUri(asset.uri);
}
