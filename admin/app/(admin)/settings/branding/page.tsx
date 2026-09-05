import { BrandingForm } from '@/components/BrandingForm';
import { getAdminBusiness } from '@/services/business';

export const dynamic = 'force-dynamic';

export default async function BrandingPage() {
  const business = await getAdminBusiness();

  if (!business) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-6 text-stone-600">
        Could not load this business. Check that the admin user is linked to a business.
      </div>
    );
  }

  return <BrandingForm business={business} />;
}
