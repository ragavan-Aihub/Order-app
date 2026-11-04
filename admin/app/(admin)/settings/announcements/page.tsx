import { AnnouncementForm } from '@/components/AnnouncementForm';
import { getAdminBusiness, getAdminShopBanners } from '@/services/business';

export const dynamic = 'force-dynamic';

export default async function AnnouncementsPage() {
  const business = await getAdminBusiness();

  if (!business) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-6 text-stone-600">
        Could not load this business. Check that the admin user is linked to a business.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Announcements</h1>
        <p className="mt-1 max-w-2xl text-stone-600">
          Choose a photo and crop it in the large frame. Customers see that same wide banner under the categories. Turn
          on a phone alert for each one that should notify them.
        </p>
      </div>
      <AnnouncementForm business={business} banners={await getAdminShopBanners(business.id)} />
    </div>
  );
}
