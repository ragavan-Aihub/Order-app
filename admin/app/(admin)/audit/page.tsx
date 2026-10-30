import Link from 'next/link';

import { AuditFilters } from '@/components/AuditFilters';
import { TableScroll } from '@/components/TableScroll';
import { getAdminAuditReport } from '@/services/admin-audit';
import { type AuditAppSource, parseAuditFilters } from '@/types/audit';
import { formatDateTime } from '@/utils/format';

export const dynamic = 'force-dynamic';

function entityLabel(entityType: string) {
  const match = entityType.replace(/_/g, ' ');
  return match.charAt(0).toUpperCase() + match.slice(1);
}

const APP_SOURCE_LABEL: Record<AuditAppSource, string> = {
  admin_panel: 'Admin panel',
  delivery_app: 'Delivery app',
};

function displaySummary(summary: string, appSource: AuditAppSource) {
  if (appSource === 'delivery_app' && summary.startsWith('[Delivery] ')) {
    return summary.slice('[Delivery] '.length);
  }
  return summary;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseAuditFilters(params);
  const result = await getAdminAuditReport(filters);

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Audit log</h1>
        <div className="rounded-xl border border-red-200 bg-white p-5 text-stone-700">
          <p className="font-medium text-red-800">Could not load the audit report.</p>
          <p className="mt-1 text-sm">{result.message}</p>
          <p className="mt-3 text-sm text-stone-600">
            If this is the first time you use audit, run migration{' '}
            <code className="text-xs">20261028210000_admin_audit_log.sql</code> in Supabase.
          </p>
          <Link href="/audit" className="mt-3 inline-block font-medium text-emerald-800">
            Try again
          </Link>
        </div>
      </div>
    );
  }

  const { rows, range } = result;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit log</h1>
        <p className="mt-1 text-stone-600">
          Changes from the admin panel and delivery app ({range.startYmd} – {range.endYmd} IST)
        </p>
      </div>

      <AuditFilters filters={filters} rangeStart={range.startYmd} rangeEnd={range.endYmd} />

      <div className="rounded-xl border border-stone-200 bg-white">
        <div className="border-b border-stone-200 px-4 py-3 text-sm text-stone-600">
          {rows.length === 0 ? 'No entries for this filter.' : `${rows.length} entries (newest first)`}
        </div>
        <div className="divide-y divide-stone-100 md:hidden">
          {rows.map((row) => (
            <div key={`${row.source}-${row.id}`} className="space-y-1 px-4 py-3 text-sm">
              <p className="text-xs text-stone-500">{formatDateTime(row.created_at)}</p>
              <p className="text-xs font-medium text-stone-600">
                {APP_SOURCE_LABEL[row.app_source]} · {entityLabel(row.entity_type)}
              </p>
              <p className="text-stone-800">
                {row.order_id ? (
                  <Link href={`/orders/${row.order_id}`} className="font-medium text-emerald-800">
                    {displaySummary(row.summary, row.app_source)}
                  </Link>
                ) : (
                  displaySummary(row.summary, row.app_source)
                )}
              </p>
            </div>
          ))}
        </div>
        <div className="hidden md:block">
          <TableScroll>
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
                <tr>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">App</th>
                  <th className="px-4 py-3 font-medium">Area</th>
                  <th className="px-4 py-3 font-medium">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map((row) => (
                  <tr key={`${row.source}-${row.id}`} className="text-stone-800">
                    <td className="whitespace-nowrap px-4 py-3 text-stone-600">{formatDateTime(row.created_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-stone-600">{APP_SOURCE_LABEL[row.app_source]}</td>
                    <td className="px-4 py-3 text-stone-600">{entityLabel(row.entity_type)}</td>
                    <td className="px-4 py-3">
                      {row.order_id ? (
                        <Link href={`/orders/${row.order_id}`} className="font-medium text-emerald-800 hover:underline">
                          {displaySummary(row.summary, row.app_source)}
                        </Link>
                      ) : (
                        displaySummary(row.summary, row.app_source)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </div>
      </div>
    </div>
  );
}
