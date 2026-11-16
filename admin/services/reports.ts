import { isCommunitiesEnabled } from '@/services/business';
import {
  dashboardInsight,
  isCollected,
  isOutstanding,
  isSale,
  sumAmount,
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
  type ReportItemLine,
  type ReportPaymentFilter,
} from '@/types/report';
import {
  istRangeForCustom,
  istRangeForPreset,
  istYmdFromIso,
  type DayRange,
} from '@/utils/ist-dates';
import { sortReportRows } from '@/utils/report-sort';
import {
  invoiceLineChange,
  invoiceLineChangeLabel,
  invoiceOrderChangeLabel,
  type InvoiceLineChange,
  type InvoiceOrderChange,
} from '@/lib/invoice-change';
import { formatLineMultiplier, formatReportPackLabel, reportSoldQty } from '@/lib/selling-units';

export {
  invoiceLineChange,
  invoiceLineChangeLabel,
  invoiceOrderChangeLabel,
  type InvoiceLineChange,
  type InvoiceOrderChange,
};

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
  itemLines: ReportItemLine[];
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
    return { ok: false, message: ctx.error ?? 'Not signed in as admin.' };
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
    return { ok: false, message: ctx.error ?? 'Not signed in as admin.' };
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

  orders = sortReportRows(orders, filters.sort, filters.dir, {
    order_number: (order) => order.order_number,
    customer: (order) => order.customer_name,
    total: (order) => Number(order.total_amount),
    status: (order) => order.status,
    payment: (order) => displayPaymentStatus(order),
    method: (order) => order.payment_method ?? '',
    channel: (order) => order.channel ?? 'app',
    community: (order) => order.community_name ?? '',
    placed: (order) => order.created_at,
  });

  const totalMatching = orders.length;
  const pageCount = Math.max(1, Math.ceil(totalMatching / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const paged = orders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const itemLines = await fetchItemLines(supabase, orders);

  return {
    ok: true,
    data: {
      filters: { ...filters, page },
      range,
      summary,
      outstanding,
      orders: paged,
      itemLines,
      totalMatching,
      pageSize: PAGE_SIZE,
      pageCount,
    },
  };
}

type ItemLineRow = ReportItemLine & {
  order_id: string;
  product_id: string | null;
};

async function fetchItemLines(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  orders: Order[],
): Promise<ReportItemLine[]> {
  const rows = await fetchItemLineRows(supabase, orders);
  return rows.map(({ order_id: _orderId, product_id: _productId, ...line }) => line);
}

async function fetchItemLineRows(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  orders: Order[],
): Promise<ItemLineRow[]> {
  const byId = new Map(orders.filter((order) => order.status !== 'cancelled').map((order) => [order.id, order]));
  const ids = [...byId.keys()];
  const lines: ItemLineRow[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data } = await supabase
      .from('order_items')
      .select(
        'order_id, product_id, product_name, quantity, subtotal, selling_type, selling_unit, pack_option_id, pack_weight_grams, weight_grams, volume_ml',
      )
      .in('order_id', chunk);
    for (const row of data ?? []) {
      const order = byId.get(row.order_id);
      if (!order) {
        continue;
      }
      lines.push({
        order_id: row.order_id,
        product_id: row.product_id,
        order_number: order.order_number,
        product_name: row.product_name,
        quantity: Number(row.quantity),
        subtotal: Number(row.subtotal),
        selling_type: row.selling_type,
        selling_unit: row.selling_unit,
        pack_option_id: row.pack_option_id,
        pack_weight_grams: row.pack_weight_grams,
        weight_grams: row.weight_grams,
        volume_ml: row.volume_ml,
      });
    }
  }
  return lines;
}

function itemGroupKey(line: {
  product_id?: string | null;
  product_name: string;
  selling_type?: string | null;
  pack_option_id?: string | null;
  pack_weight_grams?: number | null;
  weight_grams?: number | null;
  volume_ml?: number | null;
}): string {
  return [
    line.product_id ?? line.product_name.trim().toLowerCase(),
    line.selling_type ?? '',
    line.pack_option_id ?? '',
    line.pack_weight_grams ?? '',
    line.weight_grams ?? '',
    line.volume_ml ?? '',
  ].join('|');
}

function itemSalesGroupKey(line: {
  product_id?: string | null;
  product_name: string;
  selling_type?: string | null;
  pack_option_id?: string | null;
  pack_weight_grams?: number | null;
  weight_grams?: number | null;
  volume_ml?: number | null;
}): string {
  const product = line.product_id ?? line.product_name.trim().toLowerCase();
  const type = line.selling_type ?? '';
  if (type === 'kg') {
    return `${product}|kg`;
  }
  if (type === 'liter') {
    return `${product}|liter`;
  }
  if (type === 'fixed_pack') {
    return [product, 'fixed_pack', line.pack_option_id ?? '', line.pack_weight_grams ?? ''].join('|');
  }
  return itemGroupKey(line);
}

export type ItemSalesRow = {
  rowKey: string;
  product_name: string;
  packLabel: string | null;
  qty: number;
  qtyLabel: string;
  orderCount: number;
  amount: number;
};

export type DailySalesRow = {
  ymd: string;
  orders: number;
  sales: number;
  deliveredSales: number;
  collected: number;
  outstanding: number;
  cancelled: number;
};

export type CustomerSalesRow = {
  key: string;
  name: string;
  mobile: string;
  customerId: string | null;
  orderCount: number;
  sales: number;
  lastOrderAt: string;
  outstanding: number;
};

export type InvoiceVarianceLine = {
  rowKey: string;
  product_name: string;
  orderedQty: number;
  billedQty: number;
  orderedAmount: number;
  billedAmount: number;
  change: InvoiceLineChange;
};

export type InvoiceVarianceOrderRow = {
  orderId: string;
  orderNumber: number;
  customerName: string;
  orderedTotal: number;
  billedTotal: number;
  change: InvoiceOrderChange;
  lines: InvoiceVarianceLine[];
};

function invoiceOrderChange(lines: InvoiceVarianceLine[]): InvoiceOrderChange {
  const kinds = new Set(lines.map((line) => line.change).filter((change) => change !== 'no_difference'));
  if (kinds.size === 0) {
    return 'no_difference';
  }
  const up = kinds.has('excess') || kinds.has('added');
  const down = kinds.has('short') || kinds.has('removed');
  if (up && down) {
    return 'mixed';
  }
  return up ? 'excess' : 'short';
}

export type CollectionsBreakdown = {
  cashCollected: number;
  upiCollected: number;
  refundedCount: number;
};

async function filteredOrders(
  filters: ReportFilters,
): Promise<QueryResult<{ orders: Order[]; range: DayRange }>> {
  const ctx = await adminContext();
  if ('error' in ctx) {
    return { ok: false, message: ctx.error ?? 'Not signed in as admin.' };
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
  return { ok: true, data: { orders, range } };
}

export async function getItemSalesReport(filters: ReportFilters): Promise<
  QueryResult<{ filters: ReportFilters; range: DayRange; rows: ItemSalesRow[]; totalAmount: number }>
> {
  const loaded = await filteredOrders(filters);
  if (!loaded.ok) {
    return loaded;
  }
  const ctx = await adminContext();
  if ('error' in ctx) {
    return { ok: false, message: ctx.error ?? 'Not signed in as admin.' };
  }
  const lines = await fetchItemLineRows(ctx.supabase, loaded.data.orders);
  const groups = new Map<
    string,
    { sample: ItemLineRow; qty: number; amount: number; orders: Set<string> }
  >();
  for (const line of lines) {
    const key = itemSalesGroupKey(line);
    const current = groups.get(key);
    if (current) {
      current.qty += reportSoldQty(line);
      current.amount += line.subtotal;
      current.orders.add(line.order_id);
    } else {
      groups.set(key, {
        sample: line,
        qty: reportSoldQty(line),
        amount: line.subtotal,
        orders: new Set([line.order_id]),
      });
    }
  }
  const rows = sortReportRows(
    [...groups.entries()]
      .map(([rowKey, group]) => ({
        rowKey,
        product_name: group.sample.product_name,
        packLabel: formatReportPackLabel(group.sample),
        qty: group.qty,
        qtyLabel: formatLineMultiplier(group.qty),
        orderCount: group.orders.size,
        amount: group.amount,
      }))
      .sort((a, b) => b.amount - a.amount),
    filters.sort,
    filters.dir,
    {
      item: (row) => row.product_name,
      pack: (row) => row.packLabel ?? '',
      qty: (row) => row.qty,
      orders: (row) => row.orderCount,
      amount: (row) => row.amount,
    },
  );
  return {
    ok: true,
    data: {
      filters,
      range: loaded.data.range,
      rows,
      totalAmount: rows.reduce((sum, row) => sum + row.amount, 0),
    },
  };
}

export async function getDailySalesReport(filters: ReportFilters): Promise<
  QueryResult<{ filters: ReportFilters; range: DayRange; rows: DailySalesRow[] }>
> {
  const loaded = await filteredOrders(filters);
  if (!loaded.ok) {
    return loaded;
  }
  const byDay = new Map<string, Order[]>();
  for (const order of loaded.data.orders) {
    const ymd = istYmdFromIso(order.created_at);
    const list = byDay.get(ymd) ?? [];
    list.push(order);
    byDay.set(ymd, list);
  }
  const rows = sortReportRows(
    [...byDay.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([ymd, dayOrders]) => {
        const sales = dayOrders.filter(isSale);
        return {
          ymd,
          orders: dayOrders.length,
          sales: sumAmount(sales),
          deliveredSales: sumAmount(sales.filter((order) => order.status === 'delivered')),
          collected: sumAmount(dayOrders.filter(isCollected)),
          outstanding: sumAmount(dayOrders.filter(isOutstanding)),
          cancelled: dayOrders.filter((order) => order.status === 'cancelled').length,
        };
      }),
    filters.sort,
    filters.dir,
    {
      date: (row) => row.ymd,
      orders: (row) => row.orders,
      sales: (row) => row.sales,
      delivered: (row) => row.deliveredSales,
      collected: (row) => row.collected,
      outstanding: (row) => row.outstanding,
      cancelled: (row) => row.cancelled,
    },
  );
  return { ok: true, data: { filters, range: loaded.data.range, rows } };
}

export async function getCustomerSalesReport(filters: ReportFilters): Promise<
  QueryResult<{ filters: ReportFilters; range: DayRange; rows: CustomerSalesRow[] }>
> {
  const loaded = await filteredOrders(filters);
  if (!loaded.ok) {
    return loaded;
  }
  const groups = new Map<string, CustomerSalesRow>();
  for (const order of loaded.data.orders) {
    const key = order.customer_id || order.mobile || order.customer_name;
    const current = groups.get(key);
    const sale = isSale(order) ? Number(order.total_amount) : 0;
    const due = isOutstanding(order) ? Number(order.total_amount) : 0;
    if (current) {
      current.orderCount += 1;
      current.sales += sale;
      current.outstanding += due;
      if (order.created_at > current.lastOrderAt) {
        current.lastOrderAt = order.created_at;
        current.name = order.customer_name;
        current.mobile = order.mobile;
      }
    } else {
      groups.set(key, {
        key,
        name: order.customer_name,
        mobile: order.mobile,
        customerId: order.customer_id,
        orderCount: 1,
        sales: sale,
        lastOrderAt: order.created_at,
        outstanding: due,
      });
    }
  }
  const rows = sortReportRows(
    [...groups.values()].sort((a, b) => b.sales - a.sales),
    filters.sort,
    filters.dir,
    {
      customer: (row) => row.name,
      phone: (row) => row.mobile,
      orders: (row) => row.orderCount,
      sales: (row) => row.sales,
      outstanding: (row) => row.outstanding,
      last_order: (row) => row.lastOrderAt,
    },
  );
  return { ok: true, data: { filters, range: loaded.data.range, rows } };
}

export async function getCollectionsReport(filters: ReportFilters): Promise<
  QueryResult<{
    filters: ReportFilters;
    range: DayRange;
    summary: ReportSummary;
    outstanding: OutstandingRow[];
    breakdown: CollectionsBreakdown;
  }>
> {
  const loaded = await filteredOrders(filters);
  if (!loaded.ok) {
    return loaded;
  }
  const ctx = await adminContext();
  if ('error' in ctx) {
    return { ok: false, message: ctx.error ?? 'Not signed in as admin.' };
  }
  const orders = loaded.data.orders;
  const summary = summarizeOrders(orders);
  const outstandingBase = orders.filter(isOutstanding);
  const deliveredAt = await deliveredAtByOrderId(
    ctx.supabase,
    outstandingBase.map((order) => order.id),
  );
  const outstanding: OutstandingRow[] = sortReportRows(
    outstandingBase.map((order) => ({
      ...order,
      deliveredAt: deliveredAt.get(order.id) ?? order.updated_at,
    })),
    filters.sort,
    filters.dir,
    {
      order_number: (order) => order.order_number,
      customer: (order) => order.customer_name,
      phone: (order) => order.mobile,
      delivered: (order) => order.deliveredAt,
      amount: (order) => Number(order.total_amount),
      payment: (order) => displayPaymentStatus(order),
      community: (order) => order.community_name ?? '',
    },
  );
  return {
    ok: true,
    data: {
      filters,
      range: loaded.data.range,
      summary,
      outstanding,
      breakdown: collectionsBreakdown(orders),
    },
  };
}

export function collectionsBreakdown(orders: Order[]): CollectionsBreakdown {
  const paid = orders.filter(isCollected);
  return {
    cashCollected: sumAmount(paid.filter((order) => order.payment_method === 'cash')),
    upiCollected: sumAmount(paid.filter((order) => order.payment_method === 'upi')),
    refundedCount: orders.filter((order) => displayPaymentStatus(order) === 'refunded' || displayPaymentStatus(order) === 'refund_pending')
      .length,
  };
}

function varianceLinesForOrder(
  placed: Array<{
    product_id: string | null;
    product_name: string;
    quantity: number;
    subtotal: number;
    selling_type?: string | null;
    pack_weight_grams?: number | null;
    weight_grams?: number | null;
    volume_ml?: number | null;
  }>,
  billed: ItemLineRow[],
): InvoiceVarianceLine[] {
  const placedLines = placed.map((line) => ({
    key: itemGroupKey(line),
    product_name: line.product_name,
    quantity: Number(line.quantity),
    subtotal: Number(line.subtotal),
  }));
  const live = billed.map((line) => ({
    key: itemGroupKey(line),
    product_name: line.product_name,
    quantity: line.quantity,
    subtotal: line.subtotal,
  }));
  const keys = [...new Set([...placedLines, ...live].map((line) => line.key))];
  return keys.map((key) => {
    const ordered = placedLines.filter((line) => line.key === key);
    const invoiced = live.filter((line) => line.key === key);
    const orderedQty = ordered.reduce((sum, line) => sum + line.quantity, 0);
    const billedQty = invoiced.reduce((sum, line) => sum + line.quantity, 0);
    return {
      rowKey: key,
      product_name: invoiced[0]?.product_name ?? ordered[0]?.product_name ?? 'Item',
      orderedQty,
      billedQty,
      orderedAmount: ordered.reduce((sum, line) => sum + line.subtotal, 0),
      billedAmount: invoiced.reduce((sum, line) => sum + line.subtotal, 0),
      change: invoiceLineChange(orderedQty, billedQty),
    };
  });
}

export async function getInvoiceVarianceReport(filters: ReportFilters): Promise<
  QueryResult<{ filters: ReportFilters; range: DayRange; rows: InvoiceVarianceOrderRow[] }>
> {
  const loaded = await filteredOrders({ ...filters, payment: 'all', method: 'all' });
  if (!loaded.ok) {
    return loaded;
  }
  const ctx = await adminContext();
  if ('error' in ctx) {
    return { ok: false, message: ctx.error ?? 'Not signed in as admin.' };
  }
  const orders = loaded.data.orders.filter((order) => order.status !== 'cancelled');
  const billed = await fetchItemLineRows(ctx.supabase, orders);
  const placedByOrder = await loadPlacedSnapshots(
    ctx.supabase,
    ctx.businessId,
    orders.map((order) => order.id),
  );
  const billedByOrder = new Map<string, ItemLineRow[]>();
  for (const line of billed) {
    const list = billedByOrder.get(line.order_id) ?? [];
    list.push(line);
    billedByOrder.set(line.order_id, list);
  }
  const rows: InvoiceVarianceOrderRow[] = [];
  for (const order of orders) {
    const live = billedByOrder.get(order.id) ?? [];
    const placed = placedByOrder.get(order.id);
    const source = placed?.length ? placed : live;
    const lines = varianceLinesForOrder(source, live);
    if (lines.length === 0) {
      continue;
    }
    rows.push({
      orderId: order.id,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      orderedTotal: lines.reduce((sum, line) => sum + line.orderedAmount, 0),
      billedTotal: lines.reduce((sum, line) => sum + line.billedAmount, 0),
      change: invoiceOrderChange(lines),
      lines,
    });
  }
  return {
    ok: true,
    data: {
      filters: { ...filters, payment: 'all', method: 'all' },
      range: loaded.data.range,
      rows: sortReportRows(rows, filters.sort, filters.dir, {
        order_number: (row) => row.orderNumber,
        customer: (row) => row.customerName,
        ordered: (row) => row.orderedTotal,
        invoiced: (row) => row.billedTotal,
        difference: (row) => row.billedTotal - row.orderedTotal,
        change: (row) => invoiceOrderChangeLabel(row.change),
      }),
    },
  };
}

export async function getInvoiceVarianceOrder(
  orderId: string,
): Promise<QueryResult<InvoiceVarianceOrderRow>> {
  const ctx = await adminContext();
  if ('error' in ctx) {
    return { ok: false, message: ctx.error ?? 'Not signed in as admin.' };
  }
  const { data: order, error } = await ctx.supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('id', orderId)
    .eq('business_id', ctx.businessId)
    .maybeSingle();
  if (error) {
    return { ok: false, message: error.message };
  }
  if (!order) {
    return { ok: false, message: 'Could not find this order.' };
  }
  const row = order as Order;
  const billed = await fetchItemLineRows(ctx.supabase, [row]);
  const placedByOrder = await loadPlacedSnapshots(ctx.supabase, ctx.businessId, [row.id]);
  const live = billed;
  const placed = placedByOrder.get(row.id);
  const source = placed?.length ? placed : live;
  const lines = varianceLinesForOrder(source, live);
  return {
    ok: true,
    data: {
      orderId: row.id,
      orderNumber: row.order_number,
      customerName: row.customer_name,
      orderedTotal: lines.reduce((sum, line) => sum + line.orderedAmount, 0),
      billedTotal: lines.reduce((sum, line) => sum + line.billedAmount, 0),
      change: invoiceOrderChange(lines),
      lines,
    },
  };
}

async function loadPlacedSnapshots(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  businessId: string,
  orderIds: string[],
): Promise<Map<string, Array<{ product_id: string | null; product_name: string; quantity: number; subtotal: number; selling_type?: string | null; pack_weight_grams?: number | null; weight_grams?: number | null; volume_ml?: number | null }>>> {
  const map = new Map<
    string,
    Array<{
      product_id: string | null;
      product_name: string;
      quantity: number;
      subtotal: number;
      selling_type?: string | null;
      pack_weight_grams?: number | null;
      weight_grams?: number | null;
      volume_ml?: number | null;
    }>
  >();
  for (let i = 0; i < orderIds.length; i += 200) {
    const chunk = orderIds.slice(i, i + 200);
    const { data } = await supabase
      .from('order_modifications')
      .select('order_id, previous_items, created_at')
      .eq('business_id', businessId)
      .in('order_id', chunk)
      .order('created_at', { ascending: true });
    for (const row of data ?? []) {
      if (map.has(row.order_id)) {
        continue;
      }
      const items = Array.isArray(row.previous_items) ? row.previous_items : [];
      map.set(
        row.order_id,
        items
          .filter((line) => line && typeof line === 'object' && typeof (line as { product_name?: string }).product_name === 'string')
          .map((line) => {
            const item = line as {
              product_id?: string | null;
              product_name: string;
              quantity: number;
              subtotal: number;
              selling_type?: string | null;
              pack_weight_grams?: number | null;
              weight_grams?: number | null;
              volume_ml?: number | null;
            };
            return {
              product_id: item.product_id ?? null,
              product_name: item.product_name,
              quantity: Number(item.quantity),
              subtotal: Number(item.subtotal),
              selling_type: item.selling_type,
              pack_weight_grams: item.pack_weight_grams,
              weight_grams: item.weight_grams,
              volume_ml: item.volume_ml,
            };
          }),
      );
    }
  }
  return map;
}
