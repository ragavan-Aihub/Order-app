import type { CartItem } from '@/cart/CartContext';
import { CART_LIMIT_ITEMS, CART_LIMIT_QTY, MAX_CART_ITEMS, MAX_ITEM_QTY } from '@/cart/limits';
import { env } from '@/config/env';
import { getIsOffline, isNetworkFailure } from '@/services/network';
import { getSupabaseClient } from '@/services/supabase';
import type { Product } from '@/types/product';
import type { Order, OrderItem, OrderWithItems } from '@/types/order';
import { OPEN_ORDER_STATUSES } from '@/types/order';

const OFFLINE_ORDER =
  'You are not connected to the internet. Please connect to the internet and try again';

const ORDER_COLUMNS =
  'id, order_number, business_id, user_id, customer_name, mobile, delivery_address, pincode, customer_address_id, total_amount, status, payment_method, cancel_reason, refund_status, created_at, updated_at';
const ORDER_COLUMNS_FALLBACK =
  'id, order_number, business_id, user_id, customer_name, mobile, delivery_address, pincode, total_amount, status, payment_method, cancel_reason, refund_status, created_at, updated_at';

export type DeliveryDetails = {
  name: string;
  mobile: string;
  address: string;
  pincode: string;
  addressId?: string;
};

function normalizeAddress(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

export async function findOpenOrderForAddress(details: {
  addressId?: string;
  address?: string;
  pincode?: string;
}): Promise<Order | null> {
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

    const selectOpen = async (columns: string) =>
      supabase
        .from('orders')
        .select(columns)
        .eq('user_id', user.id)
        .eq('business_id', env.businessId)
        .in('status', OPEN_ORDER_STATUSES)
        .order('created_at', { ascending: false });

    let { data, error } = await selectOpen(ORDER_COLUMNS);
    if (error) {
      const retry = await selectOpen(ORDER_COLUMNS_FALLBACK);
      data = retry.data;
      error = retry.error;
    }
    if (error || !data?.length) {
      return null;
    }

    const rows = data as Order[];
    if (details.addressId) {
      const byId = rows.find((row) => row.customer_address_id === details.addressId);
      if (byId) {
        return byId;
      }
    }
    const pin = details.pincode?.trim();
    const addr = details.address ? normalizeAddress(details.address) : '';
    const byLine = rows.find((row) => {
      if (pin && row.pincode !== pin) {
        return false;
      }
      if (!addr) {
        return Boolean(pin);
      }
      const stored = normalizeAddress(row.delivery_address ?? '');
      return stored === addr || stored.includes(addr) || addr.includes(stored);
    });
    return byLine ?? (rows.length === 1 ? rows[0] : null);
  } catch {
    return null;
  }
}

function cartLinesPayload(items: CartItem[]) {
  return items.map((item) => ({
    product_id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.product.id)
      ? item.product.id
      : null,
    product_name: item.product.name,
    product_price: item.product.price,
    quantity: item.quantity,
  }));
}

export function cartItemsFromOrder(order: OrderWithItems, catalog: Product[]): CartItem[] {
  return order.order_items
    .filter((item) => item.quantity > 0 && item.product_name)
    .map((item) => {
      const live = catalog.find((row) => row.id === item.product_id);
      const product: Product = {
        id: live?.id ?? item.product_id ?? item.id,
        business_id: live?.business_id ?? order.business_id,
        name: live?.name ?? item.product_name,
        description: live?.description ?? '',
        price: Number(live?.price ?? item.product_price),
        image_url: live?.image_url ?? null,
        available: true,
        active: true,
        created_at: live?.created_at ?? item.created_at,
        updated_at: live?.updated_at ?? item.created_at,
      };
      return { product, quantity: item.quantity };
    });
}

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
    const authDigits = (user.phone ?? '').replace(/\D/g, '').slice(-10);
    const profileDigits = (data?.mobile ?? '').replace(/\D/g, '').slice(-10);
    return {
      name: data?.name ?? null,
      mobile: authDigits || profileDigits || null,
    };
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
  if (items.length > MAX_CART_ITEMS) {
    throw new Error(CART_LIMIT_ITEMS);
  }
  if (items.some((item) => item.quantity > MAX_ITEM_QTY)) {
    throw new Error(CART_LIMIT_QTY);
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
  const first = {
    ...base,
    ...(communityId ? { community_id: communityId } : {}),
    ...(details.addressId ? { customer_address_id: details.addressId } : {}),
  };
  let inserted = await supabase.from('orders').insert(first).select().single();
  if ((inserted.error || !inserted.data) && (communityId || details.addressId)) {
    inserted = await supabase.from('orders').insert(base).select().single();
  }
  const order = inserted.data;
  const orderError = inserted.error;

  if (orderError || !order) {
    if (isNetworkFailure(orderError)) {
      throw new Error(OFFLINE_ORDER);
    }
    if (orderError?.code === '23505') {
      throw new Error('OPEN_ORDER');
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

export async function replaceOpenOrderItems(
  orderId: string,
  items: CartItem[],
  delivery?: {
    name: string;
    mobile: string;
    address: string;
    pincode: string;
    addressId: string;
  } | null,
): Promise<Order> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }
  if (items.length === 0) {
    throw new Error('Your cart is empty.');
  }
  if (items.length > MAX_CART_ITEMS) {
    throw new Error(CART_LIMIT_ITEMS);
  }
  if (items.some((item) => item.quantity > MAX_ITEM_QTY)) {
    throw new Error(CART_LIMIT_QTY);
  }
  const payload = {
    p_order_id: orderId,
    p_items: cartLinesPayload(items),
    ...(delivery
      ? {
          p_customer_name: delivery.name,
          p_mobile: delivery.mobile,
          p_delivery_address: delivery.address,
          p_pincode: delivery.pincode,
          p_address_id: delivery.addressId,
        }
      : {}),
  };
  const { data, error } = await supabase.rpc('customer_replace_order_items', payload);
  if (!error && data) {
    const row = Array.isArray(data) ? data[0] : data;
    return row as Order;
  }
  if (isNetworkFailure(error)) {
    throw new Error(OFFLINE_ORDER);
  }
  const missingRpc = /could not find the function|does not exist|42883/i.test(error?.message ?? '');
  if (!missingRpc) {
    throw new Error(error?.message ?? 'Could not update this order.');
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) {
    throw new Error('Please sign in with your mobile number.');
  }
  const { data: current, error: loadError } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS_FALLBACK)
    .eq('id', orderId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (loadError || !current) {
    throw new Error('Could not update this order.');
  }
  const totalAmount = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const { error: deleteError } = await supabase.from('order_items').delete().eq('order_id', orderId);
  if (deleteError) {
    throw new Error(deleteError.message);
  }
  const { error: itemsError } = await supabase.from('order_items').insert(
    items.map((item) => ({
      order_id: orderId,
      product_id: cartLinesPayload([item])[0].product_id,
      product_name: item.product.name,
      product_price: item.product.price,
      quantity: item.quantity,
      subtotal: item.product.price * item.quantity,
    })),
  );
  if (itemsError) {
    throw new Error('Could not save the order items. Try again.');
  }
  const { data: updated, error: updateError } = await supabase
    .from('orders')
    .update({ total_amount: totalAmount })
    .eq('id', orderId)
    .eq('user_id', user.id)
    .select(ORDER_COLUMNS_FALLBACK)
    .single();
  if (updateError || !updated) {
    throw new Error(updateError?.message ?? 'Could not update this order.');
  }
  return updated as Order;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function cancelMyOrder(orderId: string, reason?: string): Promise<Order> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }
  const reasonText = reason ?? 'Customer requested';
  const rpc = supabase.rpc('customer_cancel_order', {
    p_order_id: orderId,
    p_reason: reasonText,
  });
  let data: unknown = null;
  let error: { message?: string } | null = null;
  try {
    const result = await withTimeout(rpc, 8000, 'Cancel is taking too long. Try again.');
    data = result.data;
    error = result.error;
  } catch (waitError) {
    if (isNetworkFailure(waitError)) {
      throw new Error(OFFLINE_ORDER);
    }
    error = waitError as { message?: string };
  }
  if (!error && data) {
    return (Array.isArray(data) ? data[0] : data) as Order;
  }
  if (isNetworkFailure(error)) {
    throw new Error(OFFLINE_ORDER);
  }
  const timedOut = /taking too long/i.test(error?.message ?? '');
  const missingRpc = /could not find the function|does not exist|42883/i.test(error?.message ?? '');
  if (!missingRpc && !timedOut && error?.message) {
    throw new Error(error.message);
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) {
    throw new Error('Please sign in with your mobile number.');
  }
  const { data: updated, error: updateError } = await withTimeout(
    supabase
      .from('orders')
      .update({ status: 'cancelled', cancel_reason: reasonText })
      .eq('id', orderId)
      .eq('user_id', user.id)
      .in('status', OPEN_ORDER_STATUSES)
      .select(ORDER_COLUMNS_FALLBACK)
      .maybeSingle(),
    8000,
    'Cancel is taking too long. Try again.',
  );
  if (updateError || !updated) {
    throw new Error(updateError?.message ?? error?.message ?? 'Could not cancel this order.');
  }
  return updated as Order;
}

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

    let { data, error } = await supabase
      .from('orders')
      .select(ORDER_COLUMNS)
      .eq('user_id', user.id)
      .eq('business_id', env.businessId)
      .order('created_at', { ascending: false });
    if (error) {
      const retry = await supabase
        .from('orders')
        .select(ORDER_COLUMNS_FALLBACK)
        .eq('user_id', user.id)
        .eq('business_id', env.businessId)
        .order('created_at', { ascending: false });
      data = retry.data;
      error = retry.error;
    }

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
    .slice(0, 10);
}

export async function getMyOrderById(id: string): Promise<OrderWithItems | null> {
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

    const selectOrder = (columns: string) =>
      supabase.from('orders').select(columns).eq('id', id).eq('user_id', user.id).maybeSingle();
    const itemsQuery = supabase
      .from('order_items')
      .select('id, order_id, product_id, product_name, product_price, quantity, subtotal, created_at')
      .eq('order_id', id)
      .order('created_at', { ascending: true });

    let [{ data: order, error }, itemsResult] = await Promise.all([selectOrder(ORDER_COLUMNS), itemsQuery]);
    if (error) {
      const retry = await selectOrder(ORDER_COLUMNS_FALLBACK);
      order = retry.data;
      error = retry.error;
    }

    if (error || !order) {
      return null;
    }

    return {
      ...(order as Order),
      order_items: (itemsResult.data ?? []) as OrderItem[],
    };
  } catch {
    return null;
  }
}
