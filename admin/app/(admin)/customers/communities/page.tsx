import Link from 'next/link';

import { CommunitiesBoard } from '@/components/CommunitiesBoard';
import { CommunitiesEnablePanel } from '@/components/CommunitiesEnablePanel';
import { CommunityForm } from '@/components/CommunityForm';
import { isCommunitiesEnabled } from '@/services/business';
import { getCommunities } from '@/services/communities';

export const dynamic = 'force-dynamic';

export default async function CommunitiesPage() {
  const enabled = await isCommunitiesEnabled();
  const communities = enabled ? await getCommunities() : [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/customers" className="text-sm font-medium text-emerald-700">
          ← Customers
        </Link>
        <h1 className="mt-2 text-2xl font-bold md:text-3xl">
          {enabled ? `Communities (${communities.length})` : 'Communities'}
        </h1>
        <p className="mt-1 text-stone-600">
          Optional grouping for delivery. Customers never see or choose a community.
        </p>
      </div>
      <CommunitiesEnablePanel enabled={enabled} />
      {enabled ? (
        <>
          <CommunityForm />
          {communities.length === 0 ? (
            <div className="rounded-xl border border-stone-200 bg-white p-6 text-stone-600">
              No communities yet. Create one above, then you can search customers and map a delivery address.
            </div>
          ) : (
            <CommunitiesBoard communities={communities} />
          )}
        </>
      ) : null}
    </div>
  );
}
