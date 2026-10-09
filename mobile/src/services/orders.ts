import type { CartItem } from '@/cart/CartContext';
import { CART_LIMIT_ITEMS, CART_LIMIT_QTY, MAX_CART_ITEMS, MAX_ITEM_QTY } from '@/cart/limits';
import { env } from '@/config/env';
import { getIsOffline, isNetworkFailure } from '@/services/network';
import { getSupabaseClient } from '@/services/supabase';
import type { Product } from '@/types/product';
import type {
  Order,
  OrderItem,
  OrderPlacedVia,
  OrderStatus,
  OrderModification,
  OrderStatusEvent,
  OrderWithItems,
} from '@/types/order';
import { OPEN_ORDER_STATUSES, isOpenOrderStatus } from '@/types/order';

const OFFLINE_ORDER =
  'You are not connected to the internet. Please connect to the internet and try again';

const ORDER_COLUMNS =
  'id, order_number, business_id, user_id, customer_name, mobile, delivery_address, pincode, customer_address_id, total_amount, status, payment_method, cancel_reason, refund_status, placed_via, update_count, items_revision, created_at, updated_at';
const ORDER_LOOKUP_COLUMNS =
  'id, order_number, status, customer_address_id, pincode, delivery_address, created_at, total_amount, placed_via, update_count';
const UNDELIVERED_STATUSES = ['new', 'confirmed', 'out_for_delivery'] as const;
const QUERY_MS = 4000;
const ACTION_MS = 10000;
const PLACE_MS = 15000;
const PLACE_TIMEOUT = 'Placing your order is taking too long. Check My orders before trying again.';

function withTimeout<T>(promise: PromiseLike<T>, ms: number, message: string): Promise<T> {
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

export function matchOrderToAddress(
  rows: Order[],
  details: { addressId?: string; address?: string; pincode?: string },
  allowLoneFallback = true,
): Order | null {
  if (!rows.length) {
    return null;
  }
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
  if (byLine) {
    return byLine;
  }
  return allowLoneFallback && rows.length === 1 ? rows[0] : null;
}

async function sessionUserId() {
  const supabase = getSupabaseClient();
  if (!supabase || !env.businessId) {
    return { supabase: null, userId: null as string | null };
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return { supabase, userId: session?.user?.id ?? null };
}

export async function listMyOpenOrders(): Promise<Order[]> {
  const { supabase, userId } = await sessionUserId();
  if (!supabase || !userId) {
    return [];
  }
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('orders')
        .select(ORDER_LOOKUP_COLUMNS)
        .eq('user_id', userId)
        .eq('business_id', env.businessId)
        .in('status', OPEN_ORDER_STATUSES)
        .order('created_at', { ascending: false })
        .limit(8),
      QUERY_MS,
      'Checking your open order is taking too long. Try again.',
    );
    if (error || !data?.length) {
      return [];
    }
    return data as Order[];
  } catch {
    return [];
  }
}

export async function listMyUndeliveredOrders(): Promise<Order[]> {
  const { supabase, userId } = await sessionUserId();
  if (!supabase || !userId) {
    return [];
  }
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('orders')
        .select(ORDER_LOOKUP_COLUMNS)
        .eq('user_id', userId)
        .eq('business_id', env.businessId)
        .in('status', [...UNDELIVERED_STATUSES])
        .order('created_at', { ascending: false })
        .limit(8),
      QUERY_MS,
      'Checking your orders is taking too long. Try again.',
    );
    if (error || !data?.length) {
      return [];
    }
    return data as Order[];
  } catch {
    return [];
  }
}

export async function findOpenOrderForAddress(details: {
  addressId?: string;
  address?: string;
  pincode?: string;
}): Promise<Order | null> {
  const { supabase, userId } = await sessionUserId();
  if (!supabase || !userId) {
    return null;
  }

  try {
    let query = supabase
      .from('orders')
      .select(ORDER_LOOKUP_COLUMNS)
      .eq('user_id', userId)
      .eq('business_id', env.businessId)
      .in('status', OPEN_ORDER_STATUSES)
      .order('created_at', { ascending: false })
      .limit(details.addressId ? 1 : 8);
    if (details.addressId) {
      query = query.eq('customer_address_id', details.addressId);
    } else if (details.pincode) {
      query = query.eq('pincode', details.pincode.trim());
    }
    const { data, error } = await withTimeout(
      query,
      QUERY_MS,
      'Checking your open order is taking too long. Try again.',
    );
    if (error || !data?.length) {
      return null;
    }
    return matchOrderToAddress(data as Order[], details, !details.addressId);
  } catch {
    return null;
  }
}

export async function getLatestUndeliveredOrderForAddress(details: {
  addressId?: string;
  address?: string;
  pincode?: string;
}): Promise<Order | null> {
  const { supabase, userId } = await sessionUserId();
  if (!supabase || !userId) {
    return null;
  }
  try {
    const load = async (byAddressId: boolean) => {
      let query = supabase
        .from('orders')
        .select(ORDER_COLUMNS)
        .eq('user_id', userId)
        .eq('business_id', env.businessId)
        .in('status', [...UNDELIVERED_STATUSES])
        .order('created_at', { ascending: false })
        .limit(byAddressId ? 1 : 8);
      if (byAddressId && details.addressId) {
        query = query.eq('customer_address_id', details.addressId);
      } else if (details.pincode) {
        query = query.eq('pincode', details.pincode.trim());
      }
      return withTimeout(query, QUERY_MS, 'Loading this order is taking too long. Try again.');
    };

    const first = await load(Boolean(details.addressId));
    const rows = !first.error && first.data?.length ? (first.data as Order[]) : [];
    if (!rows.length && details.addressId && details.pincode) {
      const retry = await load(false);
      if (retry.error || !retry.data?.length) {
        return null;
      }
      return matchOrderToAddress(retry.data as Order[], details, true);
    }
    if (!rows.length) {
      return null;
    }
    if (details.addressId && rows.length === 1) {
      return rows[0];
    }
    return matchOrderToAddress(rows, details, true);
  } catch {
    return null;
  }
}

function isMissingColumn(error: { code?: string; message?: string }) {
  return error.code === 'PGRST204' || error.code === '42703' || /column .* does not exist/i.test(error.message ?? '');
}

async function findJustPlacedOrder(userId: string, addressId: string | undefined, since: string): Promise<Order | null> {
  const supabase = getSupabaseClient();
  if (!supabase || !addressId) {
    return null;
  }
  try {
    const { data } = await withTimeout(
      supabase
        .from('orders')
        .select(ORDER_COLUMNS)
        .eq('user_id', userId)
        .eq('business_id', env.businessId)
        .eq('customer_address_id', addressId)
        .eq('status', 'new')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      QUERY_MS,
      PLACE_TIMEOUT,
    );
    return (data as Order | null) ?? null;
  } catch {
    return null;
  }
}

async function countOrderItems(orderId: string): Promise<number | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }
  try {
    const { count, error } = await withTimeout(
      supabase.from('order_items').select('id', { count: 'exact', head: true }).eq('order_id', orderId),
      QUERY_MS,
      PLACE_TIMEOUT,
    );
    return error || count == null ? null : count;
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
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
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

export async function placeOrder(
  details: DeliveryDetails,
  items: CartItem[],
  placedVia: OrderPlacedVia = 'app',
): Promise<Order> {
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
  const startedAt = new Date(Date.now() - 60_000).toISOString();

  try {
  let communityId: string | null = null;
  if (details.addressId) {
    try {
      const { data: saved } = await withTimeout(
        supabase
          .from('customer_addresses')
          .select('community_id')
          .eq('id', details.addressId)
          .eq('user_id', signedIn.id)
          .maybeSingle(),
        QUERY_MS,
        'Address lookup timed out.',
      );
      communityId = (saved?.community_id as string | null) ?? null;
    } catch {
      communityId = null;
    }
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
    placed_via: placedVia,
    ...(communityId ? { community_id: communityId } : {}),
  };
  const first = {
    ...base,
    ...(details.addressId ? { customer_address_id: details.addressId } : {}),
  };

  let order: Order | null = null;
  let orderError: { code?: string; message?: string } | null = null;
  let recovered = false;
  try {
    let inserted = await withTimeout(
      supabase.from('orders').insert(first).select(ORDER_COLUMNS).single(),
      PLACE_MS,
      PLACE_TIMEOUT,
    );
    if (inserted.error && details.addressId && isMissingColumn(inserted.error)) {
      inserted = await withTimeout(
        supabase.from('orders').insert(base).select(ORDER_COLUMNS).single(),
        PLACE_MS,
        PLACE_TIMEOUT,
      );
    }
    order = (inserted.data as Order | null) ?? null;
    orderError = inserted.error;
  } catch (insertError) {
    order = await findJustPlacedOrder(signedIn.id, details.addressId, startedAt);
    if (!order) {
      throw insertError;
    }
    recovered = true;
  }

  if (orderError || !order) {
    if (isNetworkFailure(orderError)) {
      throw new Error(OFFLINE_ORDER);
    }
    if (orderError?.code === '23505') {
      throw new Error('OPEN_ORDER');
    }
    throw new Error(orderError?.message ?? 'Could not create the order.');
  }
  const placed = order;

  if (placed.order_number == null) {
    try {
      const { data: numbered } = await withTimeout(
        supabase.from('orders').select('order_number').eq('id', placed.id).maybeSingle(),
        QUERY_MS,
        PLACE_TIMEOUT,
      );
      if (numbered?.order_number != null) {
        placed.order_number = numbered.order_number;
      }
    } catch {
      // Order number is cosmetic here; the order itself is already saved.
    }
  }

  if (recovered && ((await countOrderItems(placed.id)) ?? 0) > 0) {
    return placed;
  }

  let itemsError: { message?: string } | null = null;
  try {
    const result = await withTimeout(
      supabase.from('order_items').insert(
        items.map((item) => ({
          order_id: placed.id,
          product_id: item.product.id,
          product_name: item.product.name,
          product_price: item.product.price,
          quantity: item.quantity,
          subtotal: item.product.price * item.quantity,
        })),
      ),
      PLACE_MS,
      PLACE_TIMEOUT,
    );
    itemsError = result.error;
  } catch (waitError) {
    itemsError = { message: waitError instanceof Error ? waitError.message : PLACE_TIMEOUT };
  }

  if (itemsError) {
    const saved = await countOrderItems(placed.id);
    if (saved == null) {
      throw new Error(PLACE_TIMEOUT);
    }
    if (saved !== items.length) {
      void Promise.resolve(
        supabase.rpc('customer_cancel_order', {
          p_order_id: placed.id,
          p_reason: 'Items could not be saved',
        }),
      ).catch(() => undefined);
      if (isNetworkFailure(itemsError)) {
        throw new Error(OFFLINE_ORDER);
      }
      throw new Error('Could not save the order items. Try again.');
    }
  }

  try {
    const { data: priced } = await withTimeout(
      supabase.from('orders').select('total_amount').eq('id', placed.id).maybeSingle(),
      QUERY_MS,
      PLACE_TIMEOUT,
    );
    if (priced?.total_amount != null) {
      placed.total_amount = Number(priced.total_amount);
    }
  } catch {
    // The server prices the order; the cart total is only a preview.
  }

  void Promise.resolve(
    supabase.from('profiles').update({ name: details.name.trim() }).eq('id', signedIn.id),
  ).catch(() => undefined);

  return placed;
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
  expectedItemsRevision?: number | null,
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
    ...(expectedItemsRevision != null ? { p_expected_items_revision: expectedItemsRevision } : {}),
  };
  const isMissingRpc = (err: { code?: string; message?: string } | null) =>
    err?.code === 'PGRST202' || /could not find the function|does not exist|42883/i.test(err?.message ?? '');
  let { data, error } = await withTimeout(
    supabase.rpc('customer_replace_order_items', payload),
    ACTION_MS,
    'Saving your order is taking too long. Try again.',
  );
  if (error && delivery && isMissingRpc(error)) {
    ({ data, error } = await withTimeout(
      supabase.rpc('customer_replace_order_items', {
        p_order_id: orderId,
        p_items: cartLinesPayload(items),
      }),
      ACTION_MS,
      'Saving your order is taking too long. Try again.',
    ));
  }
  if (!error && data) {
    const row = Array.isArray(data) ? data[0] : data;
    return row as Order;
  }
  if (isNetworkFailure(error)) {
    throw new Error(OFFLINE_ORDER);
  }
  const missingRpc = isMissingRpc(error);
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
    .select(ORDER_COLUMNS)
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
    .select(ORDER_COLUMNS)
    .single();
  if (updateError || !updated) {
    throw new Error(updateError?.message ?? 'Could not update this order.');
  }
  return updated as Order;
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
    const result = await withTimeout(rpc, QUERY_MS, 'Cancel is taking too long. Try again.');
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
      .select(ORDER_COLUMNS)
      .maybeSingle(),
    QUERY_MS,
    'Cancel is taking too long. Try again.',
  );
  if (updateError || !updated) {
    throw new Error(updateError?.message ?? error?.message ?? 'Could not cancel this order.');
  }
  return updated as Order;
}

export async function getMyOrders(): Promise<Order[]> {
  const { supabase, userId } = await sessionUserId();
  if (!supabase || !userId) {
    return [];
  }

  try {
    const { data, error } = await withTimeout(
      supabase
        .from('orders')
        .select(ORDER_COLUMNS)
        .eq('user_id', userId)
        .eq('business_id', env.businessId)
        .order('created_at', { ascending: false })
        .limit(40),
      QUERY_MS,
      'Loading orders is taking too long. Try again.',
    );

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
    const { data: items } = await withTimeout(
      supabase
        .from('order_items')
        .select('id, order_id, product_id, product_name, product_price, quantity, subtotal, created_at')
        .in(
          'order_id',
          orders.map((order) => order.id),
        )
        .order('created_at', { ascending: true }),
      QUERY_MS,
      'Loading orders is taking too long. Try again.',
    );

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

export async function listMyOrderItems(orderId: string): Promise<OrderItem[] | null> {
  const supabase = getSupabaseClient();
  if (!supabase || !orderId) {
    return null;
  }
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('order_items')
        .select('id, order_id, product_id, product_name, product_price, quantity, subtotal, created_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true }),
      ACTION_MS,
      'Loading this order is taking too long. Try again.',
    );
    if (error) {
      return null;
    }
    return (data ?? []) as OrderItem[];
  } catch {
    return null;
  }
}

export type OrderEditCheck =
  | { state: 'open' }
  | { state: 'closed'; status: OrderStatus | null; orderNumber: number | null }
  | { state: 'unknown' };

export async function checkOrderEditable(id: string): Promise<OrderEditCheck> {
  const { supabase, userId } = await sessionUserId().catch(() => ({ supabase: null, userId: null }));
  if (!supabase || !userId) {
    return { state: 'unknown' };
  }
  try {
    const { data, error } = await withTimeout(
      supabase.from('orders').select('id, order_number, status').eq('id', id).eq('user_id', userId).maybeSingle(),
      QUERY_MS,
      'Checking this order is taking too long. Try again.',
    );
    if (error) {
      return { state: 'unknown' };
    }
    if (!data) {
      return { state: 'closed', status: null, orderNumber: null };
    }
    const row = data as Pick<Order, 'status' | 'order_number'>;
    return isOpenOrderStatus(row.status)
      ? { state: 'open' }
      : { state: 'closed', status: row.status, orderNumber: row.order_number ?? null };
  } catch {
    return { state: 'unknown' };
  }
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

    const orderQuery = supabase
      .from('orders')
      .select(ORDER_COLUMNS)
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    const eventsQuery = supabase
      .from('order_status_events')
      .select('status, created_at')
      .eq('order_id', id)
      .order('created_at', { ascending: true })
      .then(({ data, error: eventsError }) => (eventsError ? [] : ((data ?? []) as OrderStatusEvent[])));

    const [{ data: order, error }, lines, statusEvents] = await withTimeout(
      Promise.all([orderQuery, listMyOrderItems(id), eventsQuery]),
      QUERY_MS,
      'Loading this order is taking too long. Try again.',
    );

    if (error || !order) {
      if (lines?.length) {
        return {
          id,
          order_number: 0,
          business_id: env.businessId,
          user_id: user.id,
          customer_name: '',
          mobile: '',
          delivery_address: '',
          pincode: '',
          total_amount: 0,
          status: 'new',
          payment_method: 'pending',
          cancel_reason: null,
          refund_status: null,
          created_at: '',
          updated_at: '',
          order_items: lines,
        } as OrderWithItems;
      }
      return null;
    }

    return {
      ...(order as Order),
      order_items: lines ?? [],
      status_events: statusEvents,
    };
  } catch {
    return null;
  }
}

function parseModificationRow(row: Record<string, unknown>): OrderModification {
  return {
    id: String(row.id),
    order_id: String(row.order_id),
    actor_type: row.actor_type === 'admin' ? 'admin' : 'customer',
    reason: typeof row.reason === 'string' ? row.reason : null,
    previous_items: Array.isArray(row.previous_items) ? (row.previous_items as OrderModification['previous_items']) : [],
    new_items: Array.isArray(row.new_items) ? (row.new_items as OrderModification['new_items']) : [],
    previous_total: Number(row.previous_total) || 0,
    new_total: Number(row.new_total) || 0,
    payment_method: (row.payment_method as Order['payment_method']) ?? 'pending',
    created_at: String(row.created_at),
  };
}

export async function getOrderModifications(orderId: string): Promise<OrderModification[]> {
  const supabase = getSupabaseClient();
  if (!supabase || !orderId) {
    return [];
  }
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('order_modifications')
        .select(
          'id, order_id, actor_type, reason, previous_items, new_items, previous_total, new_total, payment_method, created_at',
        )
        .eq('order_id', orderId)
        .order('created_at', { ascending: false }),
      QUERY_MS,
      'Loading order history is taking too long. Try again.',
    );
    if (error || !data) {
      return [];
    }
    return (data as Record<string, unknown>[]).map(parseModificationRow);
  } catch {
    return [];
  }
}

/** Latest admin modification per order (for My Orders badges). */
export async function getLatestAdminModificationsByOrderId(
  orderIds: string[],
): Promise<Map<string, OrderModification>> {
  const map = new Map<string, OrderModification>();
  if (!orderIds.length) {
    return map;
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return map;
  }
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('order_modifications')
        .select(
          'id, order_id, actor_type, reason, previous_items, new_items, previous_total, new_total, payment_method, created_at',
        )
        .in('order_id', orderIds)
        .eq('actor_type', 'admin')
        .order('created_at', { ascending: false }),
      QUERY_MS,
      'Loading order updates is taking too long. Try again.',
    );
    if (error || !data) {
      return map;
    }
    for (const row of data as Record<string, unknown>[]) {
      const mod = parseModificationRow(row);
      if (!map.has(mod.order_id)) {
        map.set(mod.order_id, mod);
      }
    }
    return map;
  } catch {
    return map;
  }
}
