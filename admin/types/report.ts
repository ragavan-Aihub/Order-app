import type { OrderStatus } from '@/types/order';
import { istRangeForPreset } from '@/utils/ist-dates';

export const REPORT_CHANNELS = [
  { value: 'app', label: 'App' },
  { value: 'admin', label: 'Admin' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'phone', label: 'Phone' },
  { value: 'direct', label: 'Direct' },
] as const;

export type ReportRangePreset = 'today' | 'yesterday' | '7d' | '30d' | 'custom';
export type ReportPaymentFilter = 'all' | 'paid' | 'pending' | 'refunded' | 'not_applicable';

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
};

export function parseReportFilters(params: Record<string, string | string[] | undefined>): ReportFilters {
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
    statusRaw === 'preparing' ||
    statusRaw === 'delivered' ||
    statusRaw === 'cancelled'
      ? statusRaw
      : 'all';
  const paymentRaw = first('payment');
  const payment: ReportPaymentFilter =
    paymentRaw === 'paid' ||
    paymentRaw === 'pending' ||
    paymentRaw === 'refunded' ||
    paymentRaw === 'not_applicable'
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
  };
}
