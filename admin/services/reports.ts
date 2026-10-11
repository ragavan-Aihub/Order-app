import { isCommunitiesEnabled } from '@/services/business';
import {
  dashboardInsight,
  isOutstanding,
  summarizeOrders,
  type ReportSummary,
} from '@/services/report-metrics';
import {
  annotateOrderRowsWithModificationFlags,
  countCustomerModifiedAfterConfirmOrders,
} from '@/services/order-modifications';
import { hydrateOrderCommunities } from '@/services/orders';
import { getAdminSession } from '@/services/supabase/admin-session';
import { createServerSupabaseClient } from '@/services/supabase/server';
import { displayPaymentStatus, type Order } from '@/types/order';
import {
  type ReportFilters,
  type ReportPaymentFilter,
} from '@/types/report';
import {
  istRangeForCustom,
  istRangeForPreset,
  type DayRange,
} from '@/utils/ist-dates';

export { parseReportFilters, REPORT_CHANNELS, type ReportFilters } from '@/types/report';

const ORDER_COLUMNS =
  'id, order_number, business_id, user_id, customer_id, customer_name, mobile, delivery_address, pincode, total_amount, status, payment_method, cancel_reason, refund_status, channel, external_id, community_id, community_name, created_at, updated_at';

const PAGE_SIZE = 25;
const FETCH_PAGE = 500;
const FETCH_CAP = 3000;

export type QueryResult<T> = { ok: true; data: T } | { ok: false; message: string };

export type DashboardData = {
  ordersToday: number;
  ordersYesterday: number;
  showYesterdayCompare: boolean;
  salesToday: number;
  deliveredToday: number;
  outstandingAmount: number;
  outstandingCount: number;
  /** Orders still Placed (not yet confirmed), across all days. */
  placedCount: number;
  /** Placed + confirmed — not yet out for delivery. */
  pendingDeliveryCount: number;
  /** Confirmed / out for delivery orders the customer changed after confirm. */
  customerModifiedAfterConfirmCount: number;
  recent: Order[];
  insight: string;
};

export type OutstandingRow = Order & { deliveredAt: string };

export type ReportsData = {
  filters: ReportFilters;
  range: DayRange;
  summary: ReportSummary;
  outstanding: OutstandingRow[];
  orders: Order[];
  totalMatching: number;
  pageSize: number;
  pageCount: number;
};

function matchesPaymentFilter(order: Order, payment: ReportPaymentFilter): boolean {
  if (payment === 'all') {
    return true;
  }
  const value = displayPaymentStatus(order);
  if (payment === 'refunded') {
    return value === 'refunded' || value === 'refund_pending';
  }
  return value === payment;
}

function escapeIlike(value: string) {
  return value.replace(/[%_,]/g, ' ').trim();
}

async function adminContext() {
  const session = await getAdminSession();
  if ('error' in session || !session.profile.business_id) {
    return { error: 'Not signed in as admin.' } as const;
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { error: 'Could not connect to the database.' } as const;
  }
  return { supabase, businessId: session.profile.business_id } as const;
}

async function fetchMatchingOrders(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  businessId: string,
  range: DayRange,
  filters: Pick<ReportFilters, 'status' | 'method' | 'channel' | 'query'>,
): Promise<{ orders: Order[]; error: string | null }> {
  const orders: Order[] = [];
  for (let from = 0; from < FETCH_CAP; from += FETCH_PAGE) {
    let query = supabase
      .from('orders')
      .select(ORDER_COLUMNS)
      .eq('business_id', businessId)
      .gte('created_at', range.startIso)
      .lte('created_at', range.endIso)
      .order('created_at', { ascending: false })
      .range(from, from + FETCH_PAGE - 1);
    if (filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }
    if (filters.method === 'cash' || filters.method === 'upi') {
      query = query.eq('payment_method', filters.method);
    }
    const needle = escapeIlike(filters.query);
    if (needle) {
      query = query.or(`customer_name.ilike.%${needle}%,mobile.ilike.%${needle}%`);
    }
    const { data, error } = await query;
    if (error) {
      return { orders: [], error: error.message };
    }
    const rows = (data ?? []) as Order[];
    orders.push(...rows);
    if (rows.length < FETCH_PAGE) {
      break;
    }
  }
  return { orders, error: null };
}

async function deliveredAtByOrderId(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  orderIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (orderIds.length === 0) {
    return map;
  }
  for (let i = 0; i < orderIds.length; i += 200) {
    const chunk = orderIds.slice(i, i + 200);
    const { data } = await supabase
      .from('order_status_events')
      .select('order_id, created_at')
      .eq('status', 'delivered')
      .in('order_id', chunk);
    for (const row of data ?? []) {
      const current = map.get(row.order_id);
      if (!current || row.created_at > current) {
        map.set(row.order_id, row.created_at);
      }
    }
  }
  return map;
}

export function rangeFromFilters(filters: ReportFilters, now = new Date()): DayRange {
  if (filters.preset === 'custom') {
    return istRangeForCustom(filters.fromYmd, filters.toYmd);
  }
  return istRangeForPreset(filters.preset, now);
}

export async function getDashboardData(): Promise<QueryResult<DashboardData>> {
  const ctx = await adminContext();
  if ('error' in ctx) {
    return { ok: false, message: ctx.error };
  }
  const { supabase, businessId } = ctx;
  const today = istRangeForPreset('today');
  const yesterday = istRangeForPreset('yesterday');

  const [
    todayFetch,
    yesterdayResult,
    outstandingResult,
    recentResult,
    eventResult,
    fallbackDelivered,
    placedResult,
    pendingDeliveryResult,
    customerModifiedAfterConfirmCount,
  ] = await Promise.all([
    fetchMatchingOrders(supabase, businessId, today, {
      status: 'all',
      method: 'all',
      channel: '',
      query: '',
    }),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', yesterday.startIso)
      .lte('created_at', yesterday.endIso),
    supabase
      .from('orders')
      .select('id, total_amount, status, payment_method, refund_status')
      .eq('business_id', businessId)
      .eq('status', 'delivered')
      .eq('payment_method', 'pending'),
    supabase
      .from('orders')
      .select(ORDER_COLUMNS)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('order_status_events')
      .select('order_id')
      .eq('status', 'delivered')
      .gte('created_at', today.startIso)
      .lte('created_at', today.endIso),
    supabase
      .from('orders')
      .select('id')
      .eq('business_id', businessId)
      .eq('status', 'delivered')
      .gte('updated_at', today.startIso)
      .lte('updated_at', today.endIso),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('status', 'new'),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .in('status', ['new', 'confirmed']),
    countCustomerModifiedAfterConfirmOrders(supabase, businessId),
  ]);

  const failed =
    yesterdayResult.error ||
    outstandingResult.error ||
    recentResult.error ||
    placedResult.error ||
    pendingDeliveryResult.error;
  if (todayFetch.error) {
    return { ok: false, message: todayFetch.error };
  }
  if (failed) {
    return { ok: false, message: failed.message };
  }

  const todayRows = todayFetch.orders;
  const salesToday = todayRows
    .filter((order) => order.status !== 'cancelled')
    .reduce((sum, order) => sum + Number(order.total_amount), 0);

  const outstandingRows = (outstandingResult.data ?? []) as Order[];
  const outstanding = outstandingRows.filter(isOutstanding);
  const outstandingAmount = outstanding.reduce((sum, order) => sum + Number(order.total_amount), 0);

  const eventIds = new Set((eventResult.data ?? []).map((row) => row.order_id as string));
  const fallbackIds = (fallbackDelivered.data ?? []).map((row) => row.id as string);
  const candidateIds = [...new Set([...eventIds, ...fallbackIds])];
  let deliveredToday = 0;
  if (candidateIds.length > 0) {
    const { data: stillDelivered, error: deliveredError } = await supabase
      .from('orders')
      .select('id')
      .eq('business_id', businessId)
      .eq('status', 'delivered')
      .in('id', candidateIds);
    if (deliveredError) {
      return { ok: false, message: deliveredError.message };
    }
    deliveredToday = (stillDelivered ?? []).length;
  }

  const hydrate = await isCommunitiesEnabled();
  const recentRaw = (recentResult.data ?? []) as Order[];
  const recentHydrated = hydrate ? await hydrateOrderCommunities(supabase, businessId, recentRaw) : recentRaw;
  const recent = await annotateOrderRowsWithModificationFlags(supabase, recentHydrated, businessId);

  const ordersToday = todayRows.length;
  const ordersYesterday = yesterdayResult.count ?? 0;

  return {
    ok: true,
    data: {
      ordersToday,
      ordersYesterday,
      showYesterdayCompare: ordersYesterday > 0,
      salesToday,
      deliveredToday,
      outstandingAmount,
      outstandingCount: outstanding.length,
      placedCount: placedResult.count ?? 0,
      pendingDeliveryCount: pendingDeliveryResult.count ?? 0,
      customerModifiedAfterConfirmCount,
      recent,
      insight: dashboardInsight({
        outstandingCount: outstanding.length,
        outstandingAmount,
        deliveredToday,
      }),
    },
  };
}

export async function getReportsData(filters: ReportFilters): Promise<QueryResult<ReportsData>> {
  const ctx = await adminContext();
  if ('error' in ctx) {
    return { ok: false, message: ctx.error };
  }
  const { supabase, businessId } = ctx;
  const range = rangeFromFilters(filters);

  const { orders: fetched, error } = await fetchMatchingOrders(supabase, businessId, range, filters);

  if (error) {
    return { ok: false, message: error };
  }

  const hydrate = await isCommunitiesEnabled();
  let orders = hydrate ? await hydrateOrderCommunities(supabase, businessId, fetched) : fetched;
  if (filters.communityId) {
    orders = orders.filter((order) => order.community_id === filters.communityId);
  }
  if (filters.channel) {
    orders = orders.filter((order) => (order.channel ?? 'app') === filters.channel);
  }
  orders = orders.filter((order) => matchesPaymentFilter(order, filters.payment));

  const summary = summarizeOrders(orders);
  const outstandingBase = orders.filter(isOutstanding);
  const deliveredAt = await deliveredAtByOrderId(
    supabase,
    outstandingBase.map((order) => order.id),
  );
  const outstanding: OutstandingRow[] = outstandingBase.map((order) => ({
    ...order,
    deliveredAt: deliveredAt.get(order.id) ?? order.updated_at,
  }));

  const totalMatching = orders.length;
  const pageCount = Math.max(1, Math.ceil(totalMatching / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const paged = orders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return {
    ok: true,
    data: {
      filters: { ...filters, page },
      range,
      summary,
      outstanding,
      orders: paged,
      totalMatching,
      pageSize: PAGE_SIZE,
      pageCount,
    },
  };
}
