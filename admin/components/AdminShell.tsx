'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { LogoutButton } from '@/components/LogoutButton';
import { isSupabaseConfigured } from '@/config/env';

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/products', label: 'Products' },
  { href: '/products/new', label: 'Add product' },
  { href: '/orders', label: 'Orders' },
  { href: '/settings', label: 'Business Settings' },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#F7F4EF] text-stone-900">
      <div className="mx-auto flex min-h-screen max-w-6xl">
        <aside className="w-56 shrink-0 border-r border-stone-200 bg-white p-6">
          <p className="mb-8 text-lg font-semibold">Admin</p>
          <nav className="flex flex-col gap-2">
            {links.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-3 py-2 text-base ${
                    isActive ? 'bg-emerald-800 text-white' : 'text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          {isSupabaseConfigured ? <LogoutButton /> : null}
        </aside>
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
