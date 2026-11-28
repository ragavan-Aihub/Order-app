import { PrintSettingsForm } from '@/components/PrintSettingsForm';
import { getAdminBusiness } from '@/services/business';

export const dynamic = 'force-dynamic';

export default async function PrintSettingsPage() {
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
        <h1 className="text-2xl font-bold md:text-3xl">Print settings</h1>
        <p className="mt-1 max-w-2xl text-stone-600">
          Default receipt design for A4 and thermal printers. Start from the market-standard layout, then
          turn fields on or off by section.
        </p>
      </div>
      <PrintSettingsForm business={business} />
    </div>
  );
}
