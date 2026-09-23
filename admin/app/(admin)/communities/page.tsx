import { CommunitiesBoard } from '@/components/CommunitiesBoard';
import { CommunityForm } from '@/components/CommunityForm';
import { getCommunities } from '@/services/communities';

export const dynamic = 'force-dynamic';

export default async function CommunitiesPage() {
  const communities = await getCommunities();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Communities ({communities.length})</h1>
        <p className="mt-1 text-stone-600">
          Optional grouping for delivery. After you create a community, manage customers and map saved addresses.
          Customers never see or choose a community.
        </p>
      </div>
      <CommunityForm />
      {communities.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white p-6 text-stone-600">
          No communities yet. Create one above, then you can search customers and map a delivery address.
        </div>
      ) : (
        <CommunitiesBoard communities={communities} />
      )}
    </div>
  );
}
