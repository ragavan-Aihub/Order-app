'use client';

import {
  ClipboardList,
  Power,
  Image,
  SlidersHorizontal,
  KeyRound,
  LayoutGrid,
  Megaphone,
  Package,
  ScrollText,
  ShoppingBag,
  Store,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, useEffect, useState, type ReactNode } from 'react';

import { LogoutButton } from '@/components/LogoutButton';
import {
  NavigationPendingOverlay,
  NavigationPendingProvider,
  useNavigationPending,
} from '@/components/NavigationPending';
import { ADMIN_PANEL_VERSION } from '@/config/admin-version';

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
  { href: '/audit', label: 'Audit log', icon: ScrollText },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/settings/business-info', label: 'Profile', icon: Store },
  { href: '/settings/announcements', label: 'Announcements', icon: Megaphone },
  { href: '/settings/shop-closed', label: 'Shop status', icon: Power },
  { href: '/settings/preferences', label: 'Preferences', icon: SlidersHorizontal },
  ...(SHOW_LATER_PHASE_MENUS ? laterPhaseLinks : []),
];

function navClass(active: boolean) {
  return `flex min-h-12 items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium md:text-base ${
    active ? 'bg-emerald-600 text-white' : 'text-stone-800 hover:bg-stone-100'
  }`;
}

function BrandMark() {
  return (
    <Link href="/" className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/branding/farm2flavours-label.jpg"
        alt=""
        className="h-12 w-12 rounded-full border-2 border-[#C8A44A] object-cover"
      />
      <span>
        <span className="block text-lg font-semibold leading-tight text-emerald-900">Farm2Flavours</span>
        <span className="block text-sm text-stone-500">Admin</span>
      </span>
    </Link>
  );
}

function NavLinks({ pathname }: { pathname: string }) {
  const { start } = useNavigationPending();
  return (
    <>
      {mainLinks.map((link) => {
        const isActive =
          link.href === '/'
            ? pathname === '/'
            : link.href === '/settings/announcements'
              ? pathname === link.href ||
                pathname.startsWith(`${link.href}/`) ||
                pathname.startsWith('/settings/messages') ||
                pathname.startsWith('/settings/notifications')
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
              start(link.href);
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

export function AdminShell({
  children,
  adminLabel = 'Admin',
}: {
  children: ReactNode;
  adminLabel?: string;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

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
    <Suspense fallback={null}>
    <NavigationPendingProvider>
    <div className="min-h-dvh bg-[#F7F4EF] text-base text-stone-900">
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

      <div className="flex min-h-dvh">
        <aside
          id="admin-nav"
          className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(20rem,calc(100vw-2.5rem))] flex-col border-r border-stone-200 bg-white p-5 pt-[max(1.25rem,env(safe-area-inset-top))] transition-transform md:sticky md:inset-auto md:top-0 md:z-0 md:w-72 md:shrink-0 md:translate-x-0 ${
            menuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          <div className="mb-6 hidden shrink-0 md:block">
            <BrandMark />
          </div>
          <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
            <NavLinks pathname={pathname} />
          </nav>
          <div className="shrink-0 space-y-2 border-t border-stone-100 pt-4">
            <p className="truncate px-3 text-base font-medium text-stone-800" title={adminLabel}>
              {adminLabel}
            </p>
            <p className="px-3 text-sm text-stone-500">Version {ADMIN_PANEL_VERSION}</p>
            <LogoutButton />
          </div>
        </aside>
        <main className="relative min-w-0 flex-1 p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:px-8 md:py-6 lg:px-10 lg:py-7">
          <NavigationPendingOverlay />
          {children}
        </main>
      </div>
    </div>
    </NavigationPendingProvider>
    </Suspense>
  );
}
