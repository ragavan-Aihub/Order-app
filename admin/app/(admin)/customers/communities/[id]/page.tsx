import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { CommunityCustomerManager } from '@/components/CommunityCustomerManager';
import { CommunityForm } from '@/components/CommunityForm';
import { isCommunitiesEnabled } from '@/services/business';
import { getCommunityById } from '@/services/communities';

export const dynamic = 'force-dynamic';

export default async function CommunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await isCommunitiesEnabled())) {
    redirect('/customers/communities');
  }
  const community = await getCommunityById(id);
  if (!community) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/customers/communities" className="text-sm font-medium text-emerald-800">
          ← Communities
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{community.name}</h1>
        <p className="mt-1 text-sm text-stone-600">
          {community.customerCount} customers · {community.orderCount} orders
        </p>
      </div>
      <CommunityForm community={community} />
      <CommunityCustomerManager
        communityId={community.id}
        communityName={community.name}
        mappedAddresses={community.mappedAddresses}
        customers={community.customers}
      />
    </div>
  );
}
