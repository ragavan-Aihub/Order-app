'use client';

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
      className="w-full rounded-lg border border-stone-200 px-3 py-2 text-left text-base font-medium text-stone-800 hover:bg-stone-100"
    >
      Sign out
    </button>
  );
}
