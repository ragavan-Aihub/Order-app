export const CUSTOMER_SOURCES = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'phone', label: 'Phone' },
  { value: 'other', label: 'Other' },
] as const;

export const ALL_CUSTOMER_SOURCES = [
  { value: 'app', label: 'App' },
  ...CUSTOMER_SOURCES,
] as const;

export type CustomerSource = (typeof ALL_CUSTOMER_SOURCES)[number]['value'];

export function customerSourceLabel(source: string | null | undefined) {
  return ALL_CUSTOMER_SOURCES.find((item) => item.value === source)?.label ?? source ?? '—';
}

export function normalizeMobile(value: string) {
  return value.replace(/\D/g, '').slice(-10);
}
