import { composeAddressLine, stateFromPincode } from '@/types/address';
import type {
  Community,
  CommunityCustomerOption,
  CommunityListItem,
  CommunityMappedAddress,
} from '@/types/community';
import { getAdminSession } from '@/services/supabase/admin-session';
import { createServerSupabaseClient } from '@/services/supabase/server';

function addressLine(row: {
  house: string | null;
  locality: string | null;
  address: string;
  pincode: string;
  city?: string | null;
}) {
  const line = composeAddressLine(
    row.house ?? '',
    row.address ?? '',
    row.locality ?? '',
    row.city ?? '',
    stateFromPincode(row.pincode),
  );
  return [line, row.pincode].filter(Boolean).join(', ');
}

export async function getCommunities(): Promise<CommunityListItem[]> {
  const session = await getAdminSession();
  if ('error' in session || !session.profile.business_id) {
    return [];
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return [];
  }
  const businessId = session.profile.business_id;

  const [{ data: rows }, { data: addresses }, { data: orders }] = await Promise.all([
    supabase
      .from('communities')
      .select('id, business_id, name, active, created_at, updated_at')
      .eq('business_id', businessId)
      .order('name', { ascending: true }),
    supabase.from('customer_addresses').select('community_id, customer_id, user_id').eq('business_id', businessId),
    supabase.from('orders').select('community_id').eq('business_id', businessId),
  ]);

  if (!rows) {
    return [];
  }

  const customersByCommunity = new Map<string, Set<string>>();
  for (const row of addresses ?? []) {
    if (!row.community_id) {
      continue;
    }
    const key = (row.customer_id as string | null) || `user:${row.user_id}`;
    const set = customersByCommunity.get(row.community_id) ?? new Set<string>();
    set.add(key);
    customersByCommunity.set(row.community_id, set);
  }

  const ordersByCommunity = new Map<string, number>();
  for (const row of orders ?? []) {
    if (!row.community_id) {
      continue;
    }
    ordersByCommunity.set(row.community_id, (ordersByCommunity.get(row.community_id) ?? 0) + 1);
  }

  return rows.map((row) => ({
    ...(row as Community),
    customerCount: customersByCommunity.get(row.id)?.size ?? 0,
    orderCount: ordersByCommunity.get(row.id) ?? 0,
  }));
}

export async function getCommunityById(id: string): Promise<
  | (CommunityListItem & { mappedAddresses: CommunityMappedAddress[]; customers: CommunityCustomerOption[] })
  | null
> {
  const list = await getCommunities();
  const community = list.find((item) => item.id === id);
  if (!community) {
    return null;
  }

  const session = await getAdminSession();
  if ('error' in session || !session.profile.business_id) {
    return null;
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return null;
  }
  const businessId = session.profile.business_id;
  const names = new Map(list.map((item) => [item.id, item.name]));

  const [{ data: people }, { data: addresses }] = await Promise.all([
    supabase.from('customers').select('id, name, mobile, auth_user_id').eq('business_id', businessId),
    supabase
      .from('customer_addresses')
      .select(
        'id, customer_id, user_id, name, mobile, house, locality, address, city, pincode, community_id, is_default',
      )
      .eq('business_id', businessId)
      .order('is_default', { ascending: false }),
  ]);

  const customers: CommunityCustomerOption[] = [];
  for (const person of people ?? []) {
    const book = (addresses ?? []).filter(
      (row) => row.customer_id === person.id || (person.auth_user_id && row.user_id === person.auth_user_id),
    );
    if (book.length === 0) {
      continue;
    }
    customers.push({
      customerId: person.id,
      name: person.name ?? book[0]?.name ?? 'Customer',
      mobile: person.mobile ?? book[0]?.mobile ?? '',
      addresses: book.map((row) => ({
        id: row.id,
        line: addressLine(row),
        communityId: row.community_id ?? null,
        communityName: row.community_id ? names.get(row.community_id) ?? null : null,
      })),
    });
  }
  customers.sort((a, b) => a.name.localeCompare(b.name));

  const mappedAddresses: CommunityMappedAddress[] = (addresses ?? [])
    .filter((row) => row.community_id === id)
    .map((row) => {
      const person = (people ?? []).find(
        (item) => item.id === row.customer_id || (row.user_id && item.auth_user_id === row.user_id),
      );
      return {
        addressId: row.id,
        customerId: person?.id ?? row.customer_id,
        name: person?.name ?? row.name,
        mobile: person?.mobile ?? row.mobile,
        addressLine: addressLine(row),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.addressLine.localeCompare(b.addressLine));

  return { ...community, mappedAddresses, customers };
}
