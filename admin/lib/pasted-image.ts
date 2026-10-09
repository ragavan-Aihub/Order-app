/** Matches product form image rules (JPG, PNG, WebP, GIF). */
export const PASTED_IMAGE_ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function normalizePastedFile(file: File): File | null {
  const type = file.type?.toLowerCase() ?? '';
  if (!PASTED_IMAGE_ALLOWED_TYPES.has(type)) {
    return null;
  }
  const name = file.name?.trim();
  if (name) {
    return file;
  }
  const ext = EXT_BY_TYPE[type] ?? 'png';
  return new File([file], `pasted-image.${ext}`, { type });
}

function fileFromDataTransfer(dt: DataTransfer | null): File | null {
  if (!dt) {
    return null;
  }
  for (const item of dt.items) {
    if (item.kind !== 'file') {
      continue;
    }
    const type = item.type?.toLowerCase() ?? '';
    if (!type.startsWith('image/')) {
      continue;
    }
    const file = item.getAsFile();
    if (file) {
      return normalizePastedFile(file);
    }
  }
  const fallback = dt.files?.[0];
  if (fallback?.type?.toLowerCase().startsWith('image/')) {
    return normalizePastedFile(fallback);
  }
  return null;
}

/** Keyboard paste on a focused drop zone (no Clipboard API permission). */
export function fileFromClipboardEvent(event: ClipboardEvent): File | null {
  return fileFromDataTransfer(event.clipboardData);
}

/**
 * Paste image button — requires HTTPS/localhost and a user click.
 * Safari/Firefox may deny; keyboard paste on the drop zone is the fallback.
 */
export async function fileFromClipboardItems(items: ClipboardItem[]): Promise<File | null> {
  for (const item of items) {
    const imageTypes = item.types.filter((type) => type.toLowerCase().startsWith('image/'));
    for (const type of imageTypes) {
      const lower = type.toLowerCase();
      const blob = await item.getType(type);
      const ext = EXT_BY_TYPE[lower] ?? 'png';
      const normalized = normalizePastedFile(
        new File([blob], `pasted-image.${ext}`, { type: lower || blob.type || 'image/png' }),
      );
      if (normalized) {
        return normalized;
      }
    }
  }
  return null;
}

/** Start `navigator.clipboard.read()` in the click handler, then pass the promise here. */
export function readImageFromNavigatorClipboard(
  readPromise: Promise<ClipboardItem[]> | null,
): Promise<File | null> {
  if (!readPromise) {
    return Promise.resolve(null);
  }
  return readPromise.then((items) => fileFromClipboardItems(items)).catch(() => null);
}

/** One-shot window paste (after focus) when Clipboard API read is blocked. */
export function readImageFromNextPaste(timeoutMs = 12_000): Promise<File | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(null);
      return;
    }
    const finish = (file: File | null) => {
      window.removeEventListener('paste', onPaste, true);
      clearTimeout(timer);
      resolve(file);
    };
    const onPaste = (event: ClipboardEvent) => {
      const file = fileFromClipboardEvent(event);
      if (!file) {
        return;
      }
      event.preventDefault();
      finish(file);
    };
    window.addEventListener('paste', onPaste, true);
    const timer = window.setTimeout(() => finish(null), timeoutMs);
  });
}
