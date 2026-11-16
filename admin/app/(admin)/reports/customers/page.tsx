import Link from 'next/link';

import { ReportChrome, ReportLoadError } from '@/components/ReportChrome';
import { ReportCsvButton } from '@/components/ReportCsvButton';
import { ReportSortTh } from '@/components/ReportSortTh';
import { TableScroll } from '@/components/TableScroll';
import { isCommunitiesEnabled } from '@/services/business';
import { getCommunities } from '@/services/communities';
import { getCustomerSalesReport } from '@/services/reports';
import { parseReportFilters, type ReportFilterParseOptions } from '@/types/report';
import { formatDateTime, formatPrice } from '@/utils/format';

export const dynamic = 'force-dynamic';

const BASE = '/reports/customers';
const PARSE: ReportFilterParseOptions = { defaultStatus: 'all' };

export default async function CustomerSalesReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = parseReportFilters(await searchParams, PARSE);
  const communitiesEnabled = await isCommunitiesEnabled();
  const [result, communities] = await Promise.all([
    getCustomerSalesReport(parsed),
    communitiesEnabled ? getCommunities() : Promise.resolve([]),
  ]);
  if (!result.ok) {
    return <ReportLoadError message={result.message} />;
  }
  const { filters, range, rows } = result.data;

  return (
    <ReportChrome
      title="Customer-wise sales"
      description="Sales, last order, and outstanding by customer for this period."
      filters={filters}
      rangeStart={range.startYmd}
      rangeEnd={range.endYmd}
      communities={communities}
      communitiesEnabled={communitiesEnabled}
      basePath={BASE}
      parseOptions={PARSE}
      actions={
        <ReportCsvButton
          filename="customer-sales.csv"
          header={['Customer', 'Phone', 'Orders', 'Sales', 'Outstanding', 'Last order']}
          rows={rows.map((row) => [
            row.name,
            row.mobile,
            String(row.orderCount),
            String(row.sales),
            String(row.outstanding),
            row.lastOrderAt,
          ])}
        />
      }
    >
      <section className="rounded-xl border border-stone-200 bg-white">
        {rows.length === 0 ? (
          <p className="p-5 text-stone-600">No customers in this period.</p>
        ) : (
          <TableScroll>
            <table className="min-w-full text-left text-base">
              <thead className="border-b border-stone-200 bg-stone-50">
                <tr>
                  <ReportSortTh label="Customer" column="customer" filters={filters} basePath={BASE} parseOptions={PARSE} />
                  <ReportSortTh label="Phone" column="phone" filters={filters} basePath={BASE} parseOptions={PARSE} />
                  <ReportSortTh label="Orders" column="orders" filters={filters} basePath={BASE} parseOptions={PARSE} />
                  <ReportSortTh label="Sales" column="sales" filters={filters} basePath={BASE} parseOptions={PARSE} />
                  <ReportSortTh label="Outstanding" column="outstanding" filters={filters} basePath={BASE} parseOptions={PARSE} />
                  <ReportSortTh label="Last order" column="last_order" filters={filters} basePath={BASE} parseOptions={PARSE} />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td className="px-3 py-2 font-medium">
                      {row.customerId ? (
                        <Link href={`/customers/${row.customerId}`} className="text-emerald-800">
                          {row.name}
                        </Link>
                      ) : (
                        row.name
                      )}
                    </td>
                    <td className="px-3 py-2">{row.mobile}</td>
                    <td className="px-3 py-2 tabular-nums">{row.orderCount}</td>
                    <td className="px-3 py-2 tabular-nums">{formatPrice(row.sales)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatPrice(row.outstanding)}</td>
                    <td className="px-3 py-2 text-stone-500">{formatDateTime(row.lastOrderAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </section>
    </ReportChrome>
  );
}
