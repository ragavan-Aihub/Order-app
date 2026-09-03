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
      className="mt-8 w-full rounded-lg px-3 py-2 text-left text-base text-stone-700 hover:bg-stone-100"
    >
      Logout
    </button>
  );
}
