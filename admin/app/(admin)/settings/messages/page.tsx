import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function MessagesRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return searchParams.then((params) => {
    const raw = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    redirect(raw === 'inbox' ? '/settings/announcements?tab=inbox' : '/settings/announcements');
  });
}
