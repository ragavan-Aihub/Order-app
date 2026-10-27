export type AuditEntityType =
  | 'order'
  | 'product'
  | 'customer'
  | 'category'
  | 'community'
  | 'business'
  | 'api_key'
  | 'import';

export type AuditLogRow = {
  id: string;
  source: 'audit_log' | 'order_modification';
  created_at: string;
  admin_user_id: string | null;
  admin_label: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  order_id: string | null;
  order_number: number | null;
};

export type AuditReportFilters = {
  preset: 'today' | '7d' | '30d' | 'custom';
  fromYmd: string;
  toYmd: string;
  entityType: 'all' | AuditEntityType;
  query: string;
};

export const AUDIT_ENTITY_OPTIONS: { value: AuditReportFilters['entityType']; label: string }[] = [
  { value: 'all', label: 'All areas' },
  { value: 'order', label: 'Orders' },
  { value: 'product', label: 'Products' },
  { value: 'customer', label: 'Customers' },
  { value: 'category', label: 'Categories' },
  { value: 'community', label: 'Communities' },
  { value: 'business', label: 'Business settings' },
  { value: 'api_key', label: 'API keys' },
  { value: 'import', label: 'Imports' },
];

export function parseAuditFilters(searchParams: Record<string, string | string[] | undefined>): AuditReportFilters {
  const one = (key: string) => {
    const v = searchParams[key];
    return Array.isArray(v) ? v[0] : v;
  };
  const presetRaw = one('range') ?? '7d';
  const preset =
    presetRaw === 'today' || presetRaw === '30d' || presetRaw === 'custom' ? presetRaw : '7d';
  const entityRaw = one('entity') ?? 'all';
  const entityType = AUDIT_ENTITY_OPTIONS.some((o) => o.value === entityRaw)
    ? (entityRaw as AuditReportFilters['entityType'])
    : 'all';
  return {
    preset,
    fromYmd: one('from') ?? '',
    toYmd: one('to') ?? '',
    entityType,
    query: (one('q') ?? '').trim(),
  };
}
