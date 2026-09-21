'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { createBrowserSupabaseClient } from '@/services/supabase/browser';

export function LogoutButton() {
  const router = useRouter();

  async function onLogout() {
    const supabase = createBrowserSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.replace('/login');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      className="flex min-h-11 w-full items-center gap-3 rounded-lg border border-stone-200 px-3 py-2 text-left text-base font-medium text-stone-800 hover:bg-stone-100"
    >
      <LogOut size={18} strokeWidth={2} className="shrink-0" aria-hidden />
      Sign out
    </button>
  );
}
