export const CUSTOMER_SOURCES = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'phone', label: 'Phone / Offline' },
  { value: 'walk_in', label: 'Direct' },
  { value: 'app', label: 'App' },
  { value: 'web', label: 'Web' },
  { value: 'other', label: 'Other' },
] as const;

export const ALL_CUSTOMER_SOURCES = CUSTOMER_SOURCES;

export type CustomerSource = (typeof ALL_CUSTOMER_SOURCES)[number]['value'];

export const ADMIN_CUSTOMER_SOURCE: CustomerSource = 'phone';

export function customerSourceLabel(source: string | null | undefined) {
  return ALL_CUSTOMER_SOURCES.find((item) => item.value === source)?.label ?? source ?? '—';
}

export function normalizeMobile(value: string) {
  return value.replace(/\D/g, '').slice(-10);
}
