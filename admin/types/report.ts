import type { OrderStatus } from '@/types/order';
import { istRangeForPreset } from '@/utils/ist-dates';

export const REPORT_CHANNELS = [
  { value: 'app', label: 'App' },
  { value: 'admin', label: 'Admin' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'phone', label: 'Phone / Offline' },
  { value: 'direct', label: 'Direct' },
] as const;

export type ReportRangePreset = 'today' | 'yesterday' | '7d' | '30d' | 'custom';
export type ReportPaymentFilter = 'all' | 'paid' | 'pending' | 'outstanding' | 'refunded';

export type ReportItemLine = {
  order_number: number | null;
  product_name: string;
  quantity: number;
  subtotal: number;
  selling_type?: string | null;
  selling_unit?: string | null;
  pack_option_id?: string | null;
  pack_weight_grams?: number | null;
  weight_grams?: number | null;
  volume_ml?: number | null;
};

export type ReportFilters = {
  preset: ReportRangePreset;
  fromYmd: string;
  toYmd: string;
  status: OrderStatus | 'all';
  payment: ReportPaymentFilter;
  method: 'all' | 'cash' | 'upi';
  channel: string;
  communityId: string;
  query: string;
  page: number;
  focusOutstanding: boolean;
  sort: string;
  dir: 'asc' | 'desc';
};

export type ReportFilterParseOptions = {
  defaultStatus?: ReportFilters['status'];
};

export function reportHref(
  basePath: string,
  next: ReportFilters,
  options?: ReportFilterParseOptions,
): string {
  const defaultStatus = options?.defaultStatus ?? 'all';
  const params = new URLSearchParams();
  if (next.preset !== '30d') {
    params.set('range', next.preset);
  }
  if (next.preset === 'custom') {
    params.set('from', next.fromYmd);
    params.set('to', next.toYmd);
  }
  if (next.status !== defaultStatus) {
    params.set('status', next.status);
  }
  if (next.payment !== 'all') {
    params.set('payment', next.payment);
  }
  if (next.method !== 'all') {
    params.set('method', next.method);
  }
  if (next.channel) {
    params.set('channel', next.channel);
  }
  if (next.communityId) {
    params.set('community', next.communityId);
  }
  if (next.query) {
    params.set('q', next.query);
  }
  if (next.page > 1) {
    params.set('page', String(next.page));
  }
  if (next.focusOutstanding) {
    params.set('focus', 'outstanding');
  }
  if (next.sort) {
    params.set('sort', next.sort);
    if (next.dir === 'desc') {
      params.set('dir', 'desc');
    }
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function parseReportFilters(
  params: Record<string, string | string[] | undefined>,
  options?: ReportFilterParseOptions,
): ReportFilters {
  const first = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const presetRaw = first('range');
  const preset: ReportRangePreset =
    presetRaw === 'today' || presetRaw === 'yesterday' || presetRaw === '7d' || presetRaw === 'custom'
      ? presetRaw
      : '30d';
  const todayRange = istRangeForPreset('30d');
  const fromYmd = first('from') || todayRange.startYmd;
  const toYmd = first('to') || todayRange.endYmd;
  const statusRaw = first('status');
  const status: OrderStatus | 'all' =
    statusRaw === 'new' ||
    statusRaw === 'confirmed' ||
    statusRaw === 'out_for_delivery' ||
    statusRaw === 'delivered' ||
    statusRaw === 'cancelled' ||
    statusRaw === 'all'
      ? statusRaw
      : (options?.defaultStatus ?? 'all');
  const paymentRaw = first('payment');
  const payment: ReportPaymentFilter =
    paymentRaw === 'paid' || paymentRaw === 'pending' || paymentRaw === 'outstanding' || paymentRaw === 'refunded'
      ? paymentRaw
      : 'all';
  const methodRaw = first('method');
  const method = methodRaw === 'cash' || methodRaw === 'upi' ? methodRaw : 'all';
  const channelRaw = first('channel') ?? '';
  const channel = REPORT_CHANNELS.some((item) => item.value === channelRaw) ? channelRaw : '';
  const page = Math.max(1, Number.parseInt(first('page') || '1', 10) || 1);
  return {
    preset,
    fromYmd,
    toYmd,
    status,
    payment,
    method,
    channel,
    communityId: first('community')?.trim() || '',
    query: first('q')?.trim() || '',
    page,
    focusOutstanding: first('focus') === 'outstanding',
    sort: first('sort')?.trim() || '',
    dir: first('dir') === 'desc' ? 'desc' : 'asc',
  };
}
