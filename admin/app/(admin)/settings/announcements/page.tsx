import { AnnouncementForm } from '@/components/AnnouncementForm';
import { CustomerMessagesTabs } from '@/components/CustomerMessagesTabs';
import { InboxBroadcastForm } from '@/components/InboxBroadcastForm';
import { getAdminBusiness, getAdminShopBanners } from '@/services/business';
import { listInboxBroadcasts } from '@/services/inbox-actions';

export const dynamic = 'force-dynamic';

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const tab = raw === 'inbox' ? 'inbox' : 'poster';

  const [business, history] = await Promise.all([getAdminBusiness(), listInboxBroadcasts()]);
  const banners = business ? await getAdminShopBanners(business.id) : [];

  return (
    <CustomerMessagesTabs
      tab={tab}
      poster={
        business ? (
          <div className="space-y-3">
            <p className="max-w-2xl text-stone-600">
              Choose a photo and crop it in the large frame. Customers see that same wide banner under the categories.
              Turn on a phone alert for each one that should notify them.
            </p>
            <AnnouncementForm business={business} banners={banners} />
          </div>
        ) : (
          <div className="rounded-xl border border-stone-200 bg-white p-6 text-stone-600">
            Could not load this business. Check that the admin user is linked to a business.
          </div>
        )
      }
      inbox={
        <div className="space-y-3">
          <p className="max-w-2xl text-stone-600">
            Send an important shop message or offer. Customers see it in the app Notifications list, and those who
            allowed alerts also get a phone push.
          </p>
          <InboxBroadcastForm history={history} />
        </div>
      }
    />
  );
}
