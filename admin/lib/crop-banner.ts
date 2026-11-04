const TARGET_WIDTH = 1600;
const TARGET_HEIGHT = 800;

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  return Math.min(1, Math.max(0, value));
}

function decodeImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Choose this poster again so it can be fitted to the frame.'));
    image.src = src;
  });
}

async function loadDrawableImage(src: string): Promise<{ image: HTMLImageElement; revoke: (() => void) | null }> {
  if (!/^https?:/i.test(src)) {
    return { image: await decodeImage(src), revoke: null };
  }
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error('Choose this poster again so it can be fitted to the frame.');
  }
  const blob = await response.blob();
  const local = URL.createObjectURL(blob);
  try {
    const image = await decodeImage(local);
    return { image, revoke: () => URL.revokeObjectURL(local) };
  } catch (error) {
    URL.revokeObjectURL(local);
    throw error;
  }
}

/** Bake the 4:3 home-screen frame into a JPEG. pan 0.5 is the center. Zoom 1 fills the frame; 0.5 shows more of the photo. */
export async function cropBannerFile(src: string, panX: number, panY: number, zoom: number): Promise<File> {
  const { image, revoke } = await loadDrawableImage(src);
  try {
    const cover = Math.max(TARGET_WIDTH / image.naturalWidth, TARGET_HEIGHT / image.naturalHeight);
    const scale = cover * Math.min(3, Math.max(0.5, zoom));
    const dw = image.naturalWidth * scale;
    const dh = image.naturalHeight * scale;
    const canvas = document.createElement('canvas');
    canvas.width = TARGET_WIDTH;
    canvas.height = TARGET_HEIGHT;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not fit this poster.');
    }
    context.fillStyle = '#e7e5e4';
    context.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);
    context.drawImage(
      image,
      (TARGET_WIDTH - dw) * clampUnit(panX),
      (TARGET_HEIGHT - dh) * clampUnit(panY),
      dw,
      dh,
    );
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (!result) {
            reject(new Error('Choose this poster again so it can be fitted to the frame.'));
            return;
          }
          resolve(result);
        },
        'image/jpeg',
        0.92,
      );
    });
    return new File([blob], 'banner.jpg', { type: 'image/jpeg' });
  } finally {
    revoke?.();
  }
}
