import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function NotificationsRedirectPage() {
  redirect('/settings/announcements?tab=inbox');
}
