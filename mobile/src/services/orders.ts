import type { CartItem } from '@/cart/CartContext';
import { env } from '@/config/env';
import { getIsOffline, isNetworkFailure } from '@/services/network';
import { getSupabaseClient } from '@/services/supabase';
import type { Order, OrderItem, OrderWithItems } from '@/types/order';

const OFFLINE_ORDER =
  'You are not connected to the internet. Please connect to the internet and try again';

export type DeliveryDetails = {
  name: string;
  mobile: string;
  address: string;
  pincode: string;
  addressId?: string;
};

export async function getCustomerProfile(): Promise<{ name: string | null; mobile: string | null } | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return null;
    }

    const { data } = await supabase.from('profiles').select('name, mobile').eq('id', user.id).maybeSingle();
    return data ?? { name: null, mobile: user.phone ?? null };
  } catch {
    return null;
  }
}

export async function getLastDeliveryDetails(): Promise<DeliveryDetails | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      return null;
    }

    const { data } = await supabase
      .from('orders')
      .select('customer_name, mobile, delivery_address, pincode')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) {
      return null;
    }

    return {
      name: data.customer_name ?? '',
      mobile: data.mobile ?? '',
      address: data.delivery_address ?? '',
      pincode: data.pincode ?? '',
    };
  } catch {
    return null;
  }
}

export async function placeOrder(details: DeliveryDetails, items: CartItem[]): Promise<Order> {
  if (await getIsOffline()) {
    throw new Error(OFFLINE_ORDER);
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }
  if (!env.businessId) {
    throw new Error('Business is not configured.');
  }
  if (items.length === 0) {
    throw new Error('Your cart is empty.');
  }

  let signedIn;
  try {
    signedIn = (await supabase.auth.getSession()).data.session?.user;
  } catch (sessionError) {
    if (isNetworkFailure(sessionError)) {
      throw new Error(OFFLINE_ORDER);
    }
    throw sessionError;
  }
  if (!signedIn) {
    throw new Error('Please sign in with your mobile number.');
  }

  const totalAmount = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  try {
  let communityId: string | null = null;
  if (details.addressId) {
    const { data: saved } = await supabase
      .from('customer_addresses')
      .select('community_id')
      .eq('id', details.addressId)
      .eq('user_id', signedIn.id)
      .maybeSingle();
    communityId = (saved?.community_id as string | null) ?? null;
  }

  const base = {
    business_id: env.businessId,
    user_id: signedIn.id,
    customer_name: details.name.trim(),
    mobile: details.mobile.trim(),
    delivery_address: details.address.trim(),
    pincode: details.pincode.trim(),
    total_amount: totalAmount,
    status: 'new',
  };
  const first = communityId ? { ...base, community_id: communityId } : base;
  let inserted = await supabase.from('orders').insert(first as typeof base).select().single();
  if ((inserted.error || !inserted.data) && communityId) {
    inserted = await supabase.from('orders').insert(base).select().single();
  }
  const order = inserted.data;
  const orderError = inserted.error;

  if (orderError || !order) {
    if (isNetworkFailure(orderError)) {
      throw new Error(OFFLINE_ORDER);
    }
    throw new Error(orderError?.message ?? 'Could not create the order.');
  }

  if (order.order_number == null) {
    const { data: numbered } = await supabase
      .from('orders')
      .select('order_number')
      .eq('id', order.id)
      .maybeSingle();
    if (numbered?.order_number != null) {
      order.order_number = numbered.order_number;
    }
  }

  const { error: itemsError } = await supabase.from('order_items').insert(
    items.map((item) => ({
      order_id: order.id,
      product_id: item.product.id,
      product_name: item.product.name,
      product_price: item.product.price,
      quantity: item.quantity,
      subtotal: item.product.price * item.quantity,
    })),
  );

  if (itemsError) {
    if (isNetworkFailure(itemsError)) {
      throw new Error(OFFLINE_ORDER);
    }
    throw new Error('Could not save the order items. Try again.');
  }

  await supabase
    .from('profiles')
    .update({ name: details.name.trim(), mobile: details.mobile.trim() })
    .eq('id', signedIn.id);

  return order as Order;
  } catch (placeError) {
    if (isNetworkFailure(placeError) || (placeError instanceof Error && placeError.message === OFFLINE_ORDER)) {
      throw new Error(OFFLINE_ORDER);
    }
    throw placeError;
  }
}

const ORDER_COLUMNS =
  'id, order_number, business_id, user_id, customer_name, mobile, delivery_address, pincode, total_amount, status, payment_method, cancel_reason, refund_status, created_at, updated_at';

export async function getMyOrders(): Promise<Order[]> {
  const supabase = getSupabaseClient();
  if (!supabase || !env.businessId) {
    return [];
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      return [];
    }

    const { data, error } = await supabase
      .from('orders')
      .select(ORDER_COLUMNS)
      .eq('user_id', user.id)
      .eq('business_id', env.businessId)
      .order('created_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data as Order[];
  } catch {
    return [];
  }
}

export async function getMyOrdersWithItems(): Promise<OrderWithItems[]> {
  const orders = await getMyOrders();
  if (orders.length === 0) {
    return [];
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return orders.map((order) => ({ ...order, order_items: [] }));
  }

  try {
    const { data: items } = await supabase
      .from('order_items')
      .select('id, order_id, product_id, product_name, product_price, quantity, subtotal, created_at')
      .in(
        'order_id',
        orders.map((order) => order.id),
      )
      .order('created_at', { ascending: true });

    const byOrder = new Map<string, OrderItem[]>();
    for (const item of (items ?? []) as OrderItem[]) {
      const list = byOrder.get(item.order_id) ?? [];
      list.push(item);
      byOrder.set(item.order_id, list);
    }

    return orders.map((order) => ({
      ...order,
      order_items: byOrder.get(order.id) ?? [],
    }));
  } catch {
    return orders.map((order) => ({ ...order, order_items: [] }));
  }
}

export async function getReorderOrders(): Promise<OrderWithItems[]> {
  return (await getMyOrdersWithItems())
    .filter((order) => order.status !== 'cancelled' && order.order_items.length > 0)
    .slice(0, 8);
}

export async function getMyOrderById(id: string): Promise<OrderWithItems | null> {
  const supabase = getSupabaseClient();
  if (!supabase || !env.businessId) {
    return null;
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      return null;
    }

    const { data: order, error } = await supabase
      .from('orders')
      .select(ORDER_COLUMNS)
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('business_id', env.businessId)
      .maybeSingle();

    if (error || !order) {
      return null;
    }

    const { data: items } = await supabase
      .from('order_items')
      .select('id, order_id, product_id, product_name, product_price, quantity, subtotal, created_at')
      .eq('order_id', id)
      .order('created_at', { ascending: true });

    return {
      ...(order as Order),
      order_items: (items ?? []) as OrderItem[],
    };
  } catch {
    return null;
  }
}
