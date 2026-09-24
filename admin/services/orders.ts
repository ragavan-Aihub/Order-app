import { getAdminSession } from '@/services/supabase/admin-session';
import { createServerSupabaseClient } from '@/services/supabase/server';
import type { Order, OrderItem, OrderWithItems } from '@/types/order';

const ORDER_COLUMNS =
  'id, order_number, business_id, user_id, customer_id, customer_name, mobile, delivery_address, pincode, total_amount, status, payment_method, cancel_reason, refund_status, channel, external_id, community_id, community_name, created_at, updated_at';

type MappedAddress = {
  community_id: string;
  customer_id: string | null;
  user_id: string | null;
  pincode: string | null;
};

function applyMappedCommunity(
  order: Order,
  mapped: MappedAddress[],
  names: Map<string, string>,
  authByCustomer: Map<string, string>,
  customerByAuth: Map<string, string>,
): Order {
  let communityId = order.community_id ?? null;
  let communityName = order.community_name?.trim() || null;
  if (communityId && !communityName) {
    communityName = names.get(communityId) ?? null;
  }
  if (!communityId) {
    const orderAuth = order.user_id ?? (order.customer_id ? authByCustomer.get(order.customer_id) : undefined);
    const orderCustomer = order.customer_id ?? (order.user_id ? customerByAuth.get(order.user_id) : undefined);
    const matches = mapped.filter(
      (row) =>
        (row.customer_id && orderCustomer && row.customer_id === orderCustomer) ||
        (row.user_id && orderAuth && row.user_id === orderAuth),
    );
    const pinMatch = matches.find((row) => row.pincode && row.pincode === order.pincode);
    const chosen = pinMatch ?? (matches.length === 1 ? matches[0] : undefined);
    if (chosen) {
      communityId = chosen.community_id;
      communityName = names.get(chosen.community_id) ?? communityName;
    }
  }
  return { ...order, community_id: communityId, community_name: communityName };
}

async function withMappedCommunity(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  businessId: string,
  orders: Order[],
): Promise<Order[]> {
  if (orders.length === 0) {
    return orders;
  }
  const [{ data: addresses }, { data: communities }, { data: people }] = await Promise.all([
    supabase
      .from('customer_addresses')
      .select('community_id, customer_id, user_id, pincode')
      .eq('business_id', businessId)
      .not('community_id', 'is', null),
    supabase.from('communities').select('id, name').eq('business_id', businessId),
    supabase.from('customers').select('id, auth_user_id').eq('business_id', businessId),
  ]);
  const mapped = (addresses ?? []).filter((row) => row.community_id) as MappedAddress[];
  const names = new Map((communities ?? []).map((row) => [row.id as string, row.name as string]));
  const authByCustomer = new Map<string, string>();
  const customerByAuth = new Map<string, string>();
  for (const person of people ?? []) {
    if (person.auth_user_id) {
      authByCustomer.set(person.id, person.auth_user_id);
      customerByAuth.set(person.auth_user_id, person.id);
    }
  }
  return orders.map((order) => applyMappedCommunity(order, mapped, names, authByCustomer, customerByAuth));
}

export async function getAllOrders(): Promise<Order[]> {
  const session = await getAdminSession();
  if ('error' in session || !session.profile.business_id) {
    return [];
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return [];
  }

  const businessId = session.profile.business_id;
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (!error && data) {
    return withMappedCommunity(supabase, businessId, data as Order[]);
  }

  const fallback = await supabase
    .from('orders')
    .select(
      'id, order_number, business_id, user_id, customer_id, customer_name, mobile, delivery_address, pincode, total_amount, status, created_at, updated_at',
    )
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (fallback.error || !fallback.data) {
    return [];
  }

  return withMappedCommunity(
    supabase,
    businessId,
    fallback.data.map((order) => ({
      ...(order as Order),
      payment_method: 'pending' as const,
      cancel_reason: null,
      refund_status: null,
      channel: 'app',
      external_id: null,
      community_id: null,
      community_name: null,
    })),
  );
}

export async function getOrderById(id: string): Promise<OrderWithItems | null> {
  const session = await getAdminSession();
  if ('error' in session || !session.profile.business_id) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return null;
  }

  const businessId = session.profile.business_id;
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('id', id)
    .eq('business_id', businessId)
    .maybeSingle();

  if (orderError || !order) {
    const fallback = await supabase
      .from('orders')
      .select(
        'id, order_number, business_id, user_id, customer_id, customer_name, mobile, delivery_address, pincode, total_amount, status, created_at, updated_at',
      )
      .eq('id', id)
      .eq('business_id', businessId)
      .maybeSingle();
    if (fallback.error || !fallback.data) {
      return null;
    }
    const { data: fallbackItems } = await supabase
      .from('order_items')
      .select('id, order_id, product_id, product_name, product_price, quantity, subtotal, created_at')
      .eq('order_id', id)
      .order('created_at', { ascending: true });
    const [hydrated] = await withMappedCommunity(supabase, businessId, [
      {
        ...(fallback.data as Order),
        payment_method: 'pending',
        cancel_reason: null,
        refund_status: null,
        channel: 'app',
        external_id: null,
        community_id: null,
        community_name: null,
      },
    ]);
    return {
      ...hydrated,
      order_items: (fallbackItems ?? []) as OrderItem[],
      status_events: [],
    };
  }

  const { data: items } = await supabase
    .from('order_items')
    .select('id, order_id, product_id, product_name, product_price, quantity, subtotal, created_at')
    .eq('order_id', id)
    .order('created_at', { ascending: true });

  const [hydrated] = await withMappedCommunity(supabase, businessId, [order as Order]);
  return {
    ...hydrated,
    order_items: (items ?? []) as OrderItem[],
    status_events: [],
  };
}
