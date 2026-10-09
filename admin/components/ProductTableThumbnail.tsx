'use client';

import { ImageOff } from 'lucide-react';
import { useEffect, useState } from 'react';

function isValidImageUrl(url: string | null | undefined): boolean {
  const trimmed = url?.trim();
  if (!trimmed) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function ProductTableThumbnail({
  src,
  alt,
  sizeClass = 'h-14 w-14',
}: {
  src: string | null | undefined;
  alt: string;
  sizeClass?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = isValidImageUrl(src) && !failed;

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!showImage) {
    return (
      <div
        className={`flex shrink-0 flex-col items-center justify-center rounded-lg bg-[#E4E4E7] text-stone-500 ${sizeClass}`}
        role="img"
        aria-label="No image"
      >
        <ImageOff className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.75} aria-hidden />
        <span className="mt-0.5 px-0.5 text-center text-[9px] font-semibold leading-tight">No Image</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src!.trim()}
      alt={alt}
      className={`shrink-0 rounded-lg object-cover ${sizeClass}`}
      onError={() => setFailed(true)}
    />
  );
}
