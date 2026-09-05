'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { LogoutButton } from '@/components/LogoutButton';

const mainLinks = [
  { href: '/', label: 'Dashboard' },
  { href: '/products', label: 'Products' },
  { href: '/products/new', label: 'Add product' },
  { href: '/orders', label: 'Orders' },
] as const;

const settingsLinks = [
  { href: '/settings/business-info', label: 'Business Info' },
  { href: '/settings/branding', label: 'Branding' },
] as const;

function navClass(active: boolean) {
  return `rounded-lg px-3 py-2 text-base ${
    active ? 'bg-emerald-800 text-white' : 'text-stone-700 hover:bg-stone-100'
  }`;
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const settingsActive = pathname.startsWith('/settings');

  return (
    <div className="min-h-screen bg-[#F7F4EF] text-stone-900">
      <div className="mx-auto flex min-h-screen max-w-6xl">
        <aside className="flex w-56 shrink-0 flex-col border-r border-stone-200 bg-white p-6">
          <p className="mb-8 text-lg font-semibold">Admin</p>
          <nav className="flex flex-col gap-2">
            {mainLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link key={link.href} href={link.href} className={navClass(isActive)}>
                  {link.label}
                </Link>
              );
            })}
            <p className={`mt-2 px-3 text-sm font-semibold ${settingsActive ? 'text-emerald-800' : 'text-stone-500'}`}>
              Settings
            </p>
            {settingsLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link key={link.href} href={link.href} className={`ml-3 ${navClass(isActive)}`}>
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto pt-8">
            <LogoutButton />
          </div>
        </aside>
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
