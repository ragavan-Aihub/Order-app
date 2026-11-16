import { ReportChrome, ReportLoadError } from '@/components/ReportChrome';
import { ReportCsvButton } from '@/components/ReportCsvButton';
import { ReportSortTh } from '@/components/ReportSortTh';
import { TableScroll } from '@/components/TableScroll';
import { isCommunitiesEnabled } from '@/services/business';
import { getCommunities } from '@/services/communities';
import { getDailySalesReport } from '@/services/reports';
import { parseReportFilters, type ReportFilterParseOptions } from '@/types/report';
import { formatPrice } from '@/utils/format';

export const dynamic = 'force-dynamic';

const BASE = '/reports/daily';
const PARSE: ReportFilterParseOptions = { defaultStatus: 'all' };

function dayLabel(ymd: string) {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(`${ymd}T12:00:00+05:30`));
}

export default async function DailySalesReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = parseReportFilters(await searchParams, PARSE);
  const communitiesEnabled = await isCommunitiesEnabled();
  const [result, communities] = await Promise.all([
    getDailySalesReport(parsed),
    communitiesEnabled ? getCommunities() : Promise.resolve([]),
  ]);
  if (!result.ok) {
    return <ReportLoadError message={result.message} />;
  }
  const { filters, range, rows } = result.data;

  return (
    <ReportChrome
      title="Daily sales summary"
      description="Totals for each day in the selected range (by order placed date)."
      filters={filters}
      rangeStart={range.startYmd}
      rangeEnd={range.endYmd}
      communities={communities}
      communitiesEnabled={communitiesEnabled}
      basePath={BASE}
      parseOptions={PARSE}
      actions={
        <ReportCsvButton
          filename="daily-sales.csv"
          header={['Date', 'Orders', 'Sales', 'Delivered sales', 'Collected', 'Outstanding', 'Cancelled']}
          rows={rows.map((row) => [
            row.ymd,
            String(row.orders),
            String(row.sales),
            String(row.deliveredSales),
            String(row.collected),
            String(row.outstanding),
            String(row.cancelled),
          ])}
        />
      }
    >
      <section className="rounded-xl border border-stone-200 bg-white">
        {rows.length === 0 ? (
          <p className="p-5 text-stone-600">No orders in this period.</p>
        ) : (
          <TableScroll>
            <table className="min-w-full text-left text-base">
              <thead className="border-b border-stone-200 bg-stone-50">
                <tr>
                  <ReportSortTh label="Date" column="date" filters={filters} basePath={BASE} parseOptions={PARSE} />
                  <ReportSortTh label="Orders" column="orders" filters={filters} basePath={BASE} parseOptions={PARSE} />
                  <ReportSortTh label="Sales" column="sales" filters={filters} basePath={BASE} parseOptions={PARSE} />
                  <ReportSortTh label="Delivered" column="delivered" filters={filters} basePath={BASE} parseOptions={PARSE} />
                  <ReportSortTh label="Collected" column="collected" filters={filters} basePath={BASE} parseOptions={PARSE} />
                  <ReportSortTh label="Outstanding" column="outstanding" filters={filters} basePath={BASE} parseOptions={PARSE} />
                  <ReportSortTh label="Cancelled" column="cancelled" filters={filters} basePath={BASE} parseOptions={PARSE} />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map((row) => (
                  <tr key={row.ymd}>
                    <td className="px-3 py-2 font-medium">{dayLabel(row.ymd)}</td>
                    <td className="px-3 py-2 tabular-nums">{row.orders}</td>
                    <td className="px-3 py-2 tabular-nums">{formatPrice(row.sales)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatPrice(row.deliveredSales)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatPrice(row.collected)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatPrice(row.outstanding)}</td>
                    <td className="px-3 py-2 tabular-nums">{row.cancelled}</td>
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
