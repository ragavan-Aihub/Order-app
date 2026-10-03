'use client';

import { MoreVertical } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

const MENU_WIDTH = 224;

export const menuItemClass =
  'flex min-h-11 w-full items-center gap-2.5 px-3 text-left text-sm font-medium text-stone-700 hover:bg-stone-50';

export function MoreMenu({
  label,
  children,
}: {
  label: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    const height = menuRef.current?.offsetHeight ?? 200;
    const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
    const below = rect.bottom + 6 + height <= window.innerHeight;
    setStyle({ left, top: below ? rect.bottom + 6 : Math.max(8, rect.top - height - 6), width: MENU_WIDTH });
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointer(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [close, open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="flex min-h-10 min-w-10 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
      >
        <MoreVertical size={18} aria-hidden />
      </button>
      {open ? (
        <div
          ref={menuRef}
          role="menu"
          style={style}
          className="fixed z-40 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-lg"
        >
          {children(close)}
        </div>
      ) : null}
    </>
  );
}
