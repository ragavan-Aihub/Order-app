'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

function tabClass(on: boolean) {
  return `inline-flex min-h-11 items-center rounded-full border px-4 text-base font-semibold ${
    on
      ? 'border-emerald-700 bg-emerald-600 text-white'
      : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-100'
  }`;
}

export function CustomerMessagesTabs({
  tab,
  poster,
  inbox,
}: {
  tab: 'poster' | 'inbox';
  poster: ReactNode;
  inbox: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Announcements</h1>
        <p className="mt-1 max-w-2xl text-stone-600">
          Posters show under categories on Home. Inbox messages go to the phone Notifications list, and can send a
          phone alert. Order status alerts stay automatic.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/settings/announcements" className={tabClass(tab === 'poster')} prefetch>
          Poster
        </Link>
        <Link href="/settings/announcements?tab=inbox" className={tabClass(tab === 'inbox')} prefetch>
          Inbox & phone
        </Link>
      </div>
      {tab === 'inbox' ? inbox : poster}
    </div>
  );
}
