'use client';

import {
  ClipboardList,
  Image,
  KeyRound,
  LayoutGrid,
  Package,
  ShoppingBag,
  Store,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { LogoutButton } from '@/components/LogoutButton';
import { PageSkeleton } from '@/components/PageSkeleton';

const ICON = { size: 18, strokeWidth: 2, className: 'shrink-0', 'aria-hidden': true } as const;

const SHOW_LATER_PHASE_MENUS = false;

const laterPhaseLinks: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/settings/business-info', label: 'Business Info', icon: Store },
  { href: '/settings/branding', label: 'Branding', icon: Image },
  { href: '/settings/api', label: 'API', icon: KeyRound },
];

const mainLinks: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: 'Dashboard', icon: LayoutGrid },
  { href: '/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/reports', label: 'Reports', icon: ClipboardList },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/customers', label: 'Customers', icon: Users },
  ...(SHOW_LATER_PHASE_MENUS ? laterPhaseLinks : []),
];

function navClass(active: boolean) {
  return `flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-base ${
    active ? 'bg-emerald-600 text-white' : 'text-stone-700 hover:bg-stone-100'
  }`;
}

function BrandMark() {
  return (
    <Link href="/" className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/branding/farm2flavours-label.jpg"
        alt=""
        className="h-10 w-10 rounded-full border-2 border-[#C8A44A] object-cover"
      />
      <span>
        <span className="block text-base font-semibold text-emerald-900">Farm2Flavours</span>
        <span className="block text-xs text-stone-500">Admin</span>
      </span>
    </Link>
  );
}

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate: (href: string) => void;
}) {
  return (
    <>
      {mainLinks.map((link) => {
        const isActive =
          link.href === '/'
            ? pathname === '/'
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            prefetch
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
                return;
              }
              if (isActive && link.href === pathname) {
                return;
              }
              onNavigate(link.href);
            }}
            className={navClass(isActive)}
          >
            <Icon {...ICON} />
            {link.label}
          </Link>
        );
      })}
    </>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
    setNavigating(false);
  }, [pathname]);

  useEffect(() => {
    if (!navigating) {
      return;
    }
    const timeout = window.setTimeout(() => setNavigating(false), 8000);
    return () => window.clearTimeout(timeout);
  }, [navigating]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a');
      if (!anchor || !anchor.href || anchor.target === '_blank') {
        return;
      }
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) {
        return;
      }
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }
      setNavigating(true);
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  return (
    <div className="min-h-dvh bg-[#F7F4EF] text-stone-900">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:hidden">
        <BrandMark />
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-controls="admin-nav"
          onClick={() => setMenuOpen((open) => !open)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-stone-200 px-3 text-base font-medium"
        >
          {menuOpen ? 'Close' : 'Menu'}
        </button>
      </header>

      {menuOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-stone-900/40 md:hidden"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <div className="mx-auto flex min-h-dvh max-w-[90rem]">
        <aside
          id="admin-nav"
          className={`fixed inset-y-0 left-0 z-50 flex w-[min(18rem,calc(100vw-2.5rem))] flex-col border-r border-stone-200 bg-white p-5 pt-[max(1.25rem,env(safe-area-inset-top))] transition-transform md:static md:z-0 md:flex md:w-60 md:translate-x-0 md:shrink-0 ${
            menuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          <div className="mb-8 hidden md:block">
            <BrandMark />
          </div>
          <nav className="flex flex-col gap-1">
            <NavLinks pathname={pathname} onNavigate={() => setNavigating(true)} />
          </nav>
          <div className="mt-auto space-y-2 border-t border-stone-100 pt-6">
            <p className="px-3 text-sm font-medium text-stone-700">Admin</p>
            <LogoutButton />
          </div>
        </aside>
        <main className="relative min-w-0 flex-1 p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:p-8">
          {navigating ? (
            <>
              <div className="pointer-events-none absolute inset-x-4 top-0 h-1 overflow-hidden rounded-full bg-emerald-100 md:inset-x-8">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-emerald-600" />
              </div>
              <PageSkeleton />
            </>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
