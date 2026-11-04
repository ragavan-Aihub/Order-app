'use client';

import { useLayoutEffect, useRef, useState } from 'react';

type Crop = { panX: number; panY: number; zoom: number };

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  return Math.min(1, Math.max(0, value));
}

export function PosterCrop({
  src,
  panX,
  panY,
  zoom,
  onChange,
}: Crop & {
  src: string;
  onChange?: (next: Crop) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [frame, setFrame] = useState({ w: 0, h: 0 });

  function readNatural(image: HTMLImageElement) {
    if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
      return;
    }
    setNatural((current) =>
      current?.w === image.naturalWidth && current?.h === image.naturalHeight
        ? current
        : { w: image.naturalWidth, h: image.naturalHeight },
    );
  }

  useLayoutEffect(() => {
    const image = imageRef.current;
    if (image?.complete) {
      readNatural(image);
      return;
    }
    setNatural(null);
  }, [src]);

  useLayoutEffect(() => {
    const element = frameRef.current;
    if (!element) {
      return;
    }
    const measure = () => {
      setFrame({ w: element.clientWidth, h: element.clientHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const cover =
    natural && frame.w > 0 && frame.h > 0 ? Math.max(frame.w / natural.w, frame.h / natural.h) : 0;
  const scale = cover * Math.min(3, Math.max(0.5, zoom));
  const placed =
    natural && scale > 0
      ? {
          width: natural.w * scale,
          height: natural.h * scale,
          left: (frame.w - natural.w * scale) * clampUnit(panX),
          top: (frame.h - natural.h * scale) * clampUnit(panY),
        }
      : null;

  function emit(next: Crop) {
    onChange?.({
      panX: clampUnit(next.panX),
      panY: clampUnit(next.panY),
      zoom: Math.min(3, Math.max(0.5, next.zoom)),
    });
  }

  return (
    <div>
      <div
        ref={frameRef}
        className={`relative aspect-[2/1] w-full overflow-hidden rounded-xl bg-stone-200 ${
          onChange ? 'cursor-grab touch-none active:cursor-grabbing' : ''
        }`}
        onPointerDown={
          onChange
            ? (event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                dragRef.current = { x: event.clientX, y: event.clientY, panX, panY };
              }
            : undefined
        }
        onPointerMove={
          onChange
            ? (event) => {
                const drag = dragRef.current;
                if (!drag || !natural || frame.w <= 0 || frame.h <= 0) {
                  return;
                }
                const nextCover = Math.max(frame.w / natural.w, frame.h / natural.h);
                const nextScale = nextCover * Math.min(3, Math.max(0.5, zoomRef.current));
                const spanX = frame.w - natural.w * nextScale;
                const spanY = frame.h - natural.h * nextScale;
                emit({
                  panX: spanX === 0 ? drag.panX : drag.panX + (event.clientX - drag.x) / spanX,
                  panY: spanY === 0 ? drag.panY : drag.panY + (event.clientY - drag.y) / spanY,
                  zoom: zoomRef.current,
                });
              }
            : undefined
        }
        onPointerUp={() => {
          dragRef.current = null;
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imageRef}
          src={src}
          alt=""
          draggable={false}
          onLoad={(event) => readNatural(event.currentTarget)}
          className="absolute select-none"
          style={
            placed
              ? {
                  maxWidth: 'none',
                  maxHeight: 'none',
                  width: placed.width,
                  height: placed.height,
                  left: placed.left,
                  top: placed.top,
                }
              : {
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: `scale(${Math.min(3, Math.max(0.5, zoom))})`,
                  transformOrigin: `50% ${clampUnit(panY) * 100}%`,
                }
          }
        />
      </div>
      {onChange ? (
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            aria-label="Zoom out to see more of the photo"
            onClick={() => emit({ panX, panY, zoom: zoom - 0.1 })}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-stone-200 text-xl font-semibold text-stone-700 hover:bg-stone-50"
          >
            −
          </button>
          <input
            type="range"
            min={50}
            max={300}
            step={5}
            value={Math.round(Math.min(3, Math.max(0.5, zoom)) * 100)}
            aria-label="Zoom poster"
            onChange={(event) => emit({ panX, panY, zoom: Number(event.target.value) / 100 })}
            className="h-8 min-w-0 flex-1 accent-emerald-600"
          />
          <button
            type="button"
            aria-label="Zoom in to crop closer"
            onClick={() => emit({ panX, panY, zoom: zoom + 0.1 })}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-stone-200 text-xl font-semibold text-stone-700 hover:bg-stone-50"
          >
            +
          </button>
          <span className="w-12 shrink-0 text-right text-sm text-stone-600">{zoom.toFixed(1)}×</span>
        </div>
      ) : null}
    </div>
  );
}
