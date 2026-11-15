const ICON_SIZE = 1024;
const NOTIFICATION_SIZE = 96;

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
    image.onerror = () => reject(new Error('Choose the logo again so it can be cropped.'));
    image.src = src;
  });
}

async function loadDrawableImage(src: string): Promise<{ image: HTMLImageElement; revoke: (() => void) | null }> {
  if (!/^https?:/i.test(src)) {
    return { image: await decodeImage(src), revoke: null };
  }
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error('Choose the logo again so it can be cropped.');
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

function canvasToPng(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Could not make this icon.'));
        return;
      }
      resolve(new File([blob], name, { type: 'image/png' }));
    }, 'image/png');
  });
}

function drawCoverSquare(
  image: HTMLImageElement,
  size: number,
  panX: number,
  panY: number,
  zoom: number,
): HTMLCanvasElement {
  const cover = Math.max(size / image.naturalWidth, size / image.naturalHeight);
  const scale = cover * Math.min(3, Math.max(0.5, zoom));
  const dw = image.naturalWidth * scale;
  const dh = image.naturalHeight * scale;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not make this icon.');
  }
  context.fillStyle = '#F4F4F5';
  context.fillRect(0, 0, size, size);
  context.drawImage(image, (size - dw) * clampUnit(panX), (size - dh) * clampUnit(panY), dw, dh);
  return canvas;
}

function toWhiteGlyph(source: HTMLCanvasElement, size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not make this icon.');
  }
  context.drawImage(source, 0, 0, size, size);
  const pixels = context.getImageData(0, 0, size, size);
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    const alpha = Math.round((1 - lum / 255) * data[i + 3]);
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = alpha;
  }
  context.clearRect(0, 0, size, size);
  context.putImageData(pixels, 0, 0);
  return canvas;
}

export async function cropAppIcons(
  src: string,
  panX: number,
  panY: number,
  zoom: number,
): Promise<{ colour: File; notification: File }> {
  const { image, revoke } = await loadDrawableImage(src);
  try {
    const colourCanvas = drawCoverSquare(image, ICON_SIZE, panX, panY, zoom);
    const glyphCanvas = toWhiteGlyph(colourCanvas, NOTIFICATION_SIZE);
    const colour = await canvasToPng(colourCanvas, 'app-icon.png');
    const notification = await canvasToPng(glyphCanvas, 'notification-icon.png');
    return { colour, notification };
  } finally {
    revoke?.();
  }
}

export function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
}
