import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { AdminShell } from '@/components/AdminShell';
import { getAdminSession } from '@/services/supabase/admin-session';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getAdminSession();

  if ('error' in session) {
    if (session.error === 'unauthenticated') {
      redirect('/login');
    }
    redirect('/unauthorized');
  }

  return <AdminShell>{children}</AdminShell>;
}
