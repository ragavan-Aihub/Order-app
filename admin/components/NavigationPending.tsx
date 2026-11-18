'use client';

import { usePathname } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { Spinner } from '@/components/ActionNotice';

type NavigationPendingContextValue = {
  pending: boolean;
  start: (href: string) => void;
};

const NavigationPendingContext = createContext<NavigationPendingContextValue>({
  pending: false,
  start: () => {},
});

export function useNavigationPending() {
  return useContext(NavigationPendingContext);
}

function hrefParts(href: string) {
  const url = new URL(href, typeof window === 'undefined' ? 'http://localhost' : window.location.href);
  return { path: url.pathname, search: url.search.replace(/^\?/, '') };
}

function currentSearch() {
  if (typeof window === 'undefined') {
    return '';
  }
  return window.location.search.replace(/^\?/, '');
}

export function NavigationPendingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [target, setTarget] = useState<{ path: string; search: string } | null>(null);

  const start = useCallback(
    (href: string) => {
      const next = hrefParts(href);
      if (next.path === pathname && next.search === currentSearch()) {
        return;
      }
      setTarget(next);
    },
    [pathname],
  );

  useEffect(() => {
    if (!target) {
      return;
    }
    if (pathname === target.path && currentSearch() === target.search) {
      setTarget(null);
    }
  }, [pathname, target]);

  useEffect(() => {
    if (!target) {
      return;
    }
    const timeout = window.setTimeout(() => setTarget(null), 25000);
    return () => window.clearTimeout(timeout);
  }, [target]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as HTMLElement | null)?.closest('a');
      if (!anchor || !anchor.href || anchor.target === '_blank' || anchor.hasAttribute('download')) {
        return;
      }
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) {
        return;
      }
      start(`${url.pathname}${url.search}`);
    }
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [start]);

  const value = useMemo(() => ({ pending: Boolean(target), start }), [start, target]);

  return <NavigationPendingContext.Provider value={value}>{children}</NavigationPendingContext.Provider>;
}

export function NavigationPendingOverlay() {
  const { pending } = useNavigationPending();
  if (!pending) {
    return null;
  }
  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-1 overflow-hidden bg-emerald-100">
        <div className="h-full w-1/3 animate-[navprogress_1s_ease-in-out_infinite] rounded-full bg-emerald-600" />
      </div>
      <div
        className="fixed inset-0 z-[55] flex items-center justify-center bg-stone-900/25 backdrop-blur-[2px]"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-5 py-4 shadow-lg">
          <Spinner size={22} />
          <div>
            <p className="text-base font-semibold text-stone-900">Opening…</p>
            <p className="text-sm text-stone-600">This can take a few seconds.</p>
          </div>
        </div>
      </div>
    </>
  );
}
