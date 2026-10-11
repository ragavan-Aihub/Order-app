import { getAdminSession } from '@/services/supabase/admin-session';
import { createServerSupabaseClient } from '@/services/supabase/server';
import type { CustomerSource } from '@/types/customer';

export type CustomerAddress = {
  id: string;
  user_id: string | null;
  customer_id: string | null;
  label: string;
  name: string;
  mobile: string;
  alt_mobile: string | null;
  house: string | null;
  locality: string | null;
  address: string;
  city: string | null;
  pincode: string;
  instructions: string | null;
  is_default: boolean;
  community_id?: string | null;
};

export type CustomerListItem = {
  id: string;
  name: string | null;
  mobile: string | null;
  source: CustomerSource | string;
  created_at: string;
  addressCount: number;
  defaultAddress: string | null;
  orderCount: number;
  lastOrderAt: string | null;
};

export type CustomerDetail = {
  id: string;
  name: string | null;
  mobile: string | null;
  source: CustomerSource | string;
  notes: string | null;
  auth_user_id: string | null;
  created_at: string;
  addresses: CustomerAddress[];
  orders: Array<{
    id: string;
    order_number: number | string | null;
    total_amount: number;
    status: string;
    payment_method?: string;
    refund_status?: string | null;
    delivery_address: string;
    pincode: string;
    created_at: string;
  }>;
};

export async function getCustomers(): Promise<CustomerListItem[]> {
  const session = await getAdminSession();
  if ('error' in session || !session.profile.business_id) {
    return [];
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return [];
  }

  const businessId = session.profile.business_id;

  const [{ data: people }, { data: addresses }, { data: orders }] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name, mobile, source, auth_user_id, created_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false }),
    supabase
      .from('customer_addresses')
      .select('customer_id, user_id, address, house, locality, city, pincode, is_default')
      .eq('business_id', businessId),
    supabase.from('orders').select('customer_id, user_id, created_at').eq('business_id', businessId),
  ]);

  if (!people) {
    return [];
  }

  const customerIdByAuthUser = new Map<string, string>();
  for (const person of people) {
    if (person.auth_user_id) {
      customerIdByAuthUser.set(person.auth_user_id as string, person.id as string);
    }
  }

  const addressByCustomer = new Map<string, { count: number; defaultLine: string | null }>();
  for (const row of addresses ?? []) {
    const key =
      (row.customer_id as string | null) ??
      (row.user_id ? (customerIdByAuthUser.get(row.user_id as string) ?? null) : null);
    if (!key) {
      continue;
    }
    const current = addressByCustomer.get(key) ?? { count: 0, defaultLine: null };
    current.count += 1;
    if (row.is_default || !current.defaultLine) {
      current.defaultLine = [row.house, row.locality, row.address, row.city, row.pincode].filter(Boolean).join(', ');
    }
    addressByCustomer.set(key, current);
  }

  const orderByCustomer = new Map<string, { count: number; lastAt: string | null }>();
  for (const row of orders ?? []) {
    const key =
      (row.customer_id as string | null) ??
      (row.user_id ? (customerIdByAuthUser.get(row.user_id as string) ?? null) : null);
    if (!key) {
      continue;
    }
    const current = orderByCustomer.get(key) ?? { count: 0, lastAt: null };
    current.count += 1;
    if (!current.lastAt || row.created_at > current.lastAt) {
      current.lastAt = row.created_at;
    }
    orderByCustomer.set(key, current);
  }

  return people.map((person) => {
    const book = addressByCustomer.get(person.id);
    const order = orderByCustomer.get(person.id);
    return {
      id: person.id,
      name: person.name,
      mobile: person.mobile,
      source: person.source,
      created_at: person.created_at,
      addressCount: book?.count ?? 0,
      defaultAddress: book?.defaultLine ?? null,
      orderCount: order?.count ?? 0,
      lastOrderAt: order?.lastAt ?? null,
    };
  });
}

export async function getCustomerById(id: string): Promise<CustomerDetail | null> {
  const session = await getAdminSession();
  if ('error' in session || !session.profile.business_id) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return null;
  }

  const businessId = session.profile.business_id;

  const { data: person } = await supabase
    .from('customers')
    .select('id, name, mobile, source, notes, auth_user_id, created_at')
    .eq('id', id)
    .eq('business_id', businessId)
    .maybeSingle();

  if (!person) {
    return null;
  }

  const addressFilter = person.auth_user_id
    ? `customer_id.eq.${id},user_id.eq.${person.auth_user_id}`
    : `customer_id.eq.${id}`;

  const [{ data: addresses }, { data: ordersByCustomerId }, { data: ordersByUserId }] = await Promise.all([
    supabase
      .from('customer_addresses')
      .select(
        'id, user_id, customer_id, label, name, mobile, alt_mobile, house, locality, address, city, pincode, instructions, is_default, community_id',
      )
      .eq('business_id', businessId)
      .or(addressFilter)
      .order('is_default', { ascending: false }),
    supabase
      .from('orders')
      .select(
        'id, order_number, total_amount, status, payment_method, refund_status, delivery_address, pincode, created_at',
      )
      .eq('customer_id', id)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(20),
    person.auth_user_id
      ? supabase
          .from('orders')
          .select(
            'id, order_number, total_amount, status, payment_method, refund_status, delivery_address, pincode, created_at',
          )
          .eq('user_id', person.auth_user_id)
          .eq('business_id', businessId)
          .is('customer_id', null)
          .order('created_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
  ]);

  const orderMap = new Map<string, CustomerDetail['orders'][number]>();
  for (const row of [...(ordersByCustomerId ?? []), ...(ordersByUserId ?? [])]) {
    orderMap.set(row.id as string, row as CustomerDetail['orders'][number]);
  }
  const mergedOrders = [...orderMap.values()]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20);

  return {
    id: person.id,
    name: person.name,
    mobile: person.mobile,
    source: person.source,
    notes: person.notes,
    auth_user_id: person.auth_user_id,
    created_at: person.created_at,
    addresses: (addresses ?? []) as CustomerAddress[],
    orders: mergedOrders,
  };
}

export async function getCustomerAddresses(): Promise<CustomerAddress[]> {
  const session = await getAdminSession();
  if ('error' in session || !session.profile.business_id) {
    return [];
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return [];
  }

  const { data } = await supabase
    .from('customer_addresses')
    .select(
      'id, user_id, customer_id, label, name, mobile, alt_mobile, house, locality, address, city, pincode, instructions, is_default, community_id',
    )
    .eq('business_id', session.profile.business_id);

  return (data ?? []) as CustomerAddress[];
}
