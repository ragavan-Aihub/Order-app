import { BusinessInfoForm } from '@/components/BusinessInfoForm';
import { getAdminBusiness } from '@/services/business';

export const dynamic = 'force-dynamic';

export default async function BusinessInfoPage() {
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
        <h1 className="text-2xl font-bold md:text-3xl">Profile</h1>
        <p className="mt-1 text-stone-600">
          Shop logo, phone, and address. The logo and welcome photo appear on the customer welcome screen. The logo
          also prints on the delivery bill.
        </p>
      </div>
      <BusinessInfoForm business={business} />
    </div>
  );
}
