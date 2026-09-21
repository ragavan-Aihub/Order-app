import { getAdminSession } from '@/services/supabase/admin-session';
import { createServerSupabaseClient } from '@/services/supabase/server';

export type CustomerAddress = {
  id: string;
  user_id: string;
  label: string;
  name: string;
  mobile: string;
  alt_mobile: string | null;
  house: string | null;
  locality: string | null;
  address: string;
  pincode: string;
  instructions: string | null;
  is_default: boolean;
};

export type CustomerListItem = {
  id: string;
  name: string | null;
  mobile: string | null;
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

  const [{ data: profiles }, { data: addresses }, { data: orders }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, mobile, created_at')
      .eq('role', 'customer')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false }),
    supabase
      .from('customer_addresses')
      .select('user_id, address, house, locality, pincode, is_default')
      .eq('business_id', businessId),
    supabase.from('orders').select('user_id, created_at').eq('business_id', businessId),
  ]);

  const addressByUser = new Map<string, { count: number; defaultLine: string | null }>();
  for (const row of addresses ?? []) {
    const current = addressByUser.get(row.user_id) ?? { count: 0, defaultLine: null };
    current.count += 1;
    if (row.is_default || !current.defaultLine) {
      const line = [row.house, row.locality, row.address, row.pincode].filter(Boolean).join(', ');
      current.defaultLine = line;
    }
    addressByUser.set(row.user_id, current);
  }

  const orderByUser = new Map<string, { count: number; lastAt: string | null }>();
  for (const row of orders ?? []) {
    const current = orderByUser.get(row.user_id) ?? { count: 0, lastAt: null };
    current.count += 1;
    if (!current.lastAt || row.created_at > current.lastAt) {
      current.lastAt = row.created_at;
    }
    orderByUser.set(row.user_id, current);
  }

  return (profiles ?? []).map((profile) => {
    const book = addressByUser.get(profile.id);
    const order = orderByUser.get(profile.id);
    return {
      id: profile.id,
      name: profile.name,
      mobile: profile.mobile,
      created_at: profile.created_at,
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, mobile, created_at')
    .eq('id', id)
    .eq('role', 'customer')
    .eq('business_id', businessId)
    .maybeSingle();

  if (!profile) {
    return null;
  }

  const [{ data: addresses }, { data: orders }] = await Promise.all([
    supabase
      .from('customer_addresses')
      .select(
        'id, user_id, label, name, mobile, alt_mobile, house, locality, address, pincode, instructions, is_default',
      )
      .eq('user_id', id)
      .eq('business_id', businessId)
      .order('is_default', { ascending: false }),
    supabase
      .from('orders')
      .select(
        'id, order_number, total_amount, status, payment_method, refund_status, delivery_address, pincode, created_at',
      )
      .eq('user_id', id)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  return {
    id: profile.id,
    name: profile.name,
    mobile: profile.mobile,
    created_at: profile.created_at,
    addresses: (addresses ?? []) as CustomerAddress[],
    orders: (orders ?? []) as CustomerDetail['orders'],
  };
}
