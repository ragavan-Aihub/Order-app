import Link from 'next/link';

import { MobileOrderRowCard } from '@/components/MobileOrderRowCard';
import { ReportChrome, ReportLoadError } from '@/components/ReportChrome';
import { ReportsItemLines } from '@/components/ReportsItemLines';
import { ReportSortTh, ReportTh } from '@/components/ReportSortTh';
import { PaymentStatusBadge, StatusBadge } from '@/components/OrderBadges';
import { TableScroll } from '@/components/TableScroll';
import { isCommunitiesEnabled } from '@/services/business';
import { getCommunities } from '@/services/communities';
import { getReportsData } from '@/services/reports';
import { parseReportFilters, reportHref } from '@/types/report';
import { orderChannelLabel, paymentModeLabel } from '@/types/order';
import { formatDateTime, formatOrderNumber, formatPrice } from '@/utils/format';

export const dynamic = 'force-dynamic';

const BASE = '/reports/sales-orders';

export default async function SalesOrdersReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const parsed = parseReportFilters(params);
  const communitiesEnabled = await isCommunitiesEnabled();
  const [result, communities] = await Promise.all([
    getReportsData(parsed),
    communitiesEnabled ? getCommunities() : Promise.resolve([]),
  ]);

  if (!result.ok) {
    return <ReportLoadError message={result.message} />;
  }

  const data = result.data;
  const { filters, summary, orders } = data;
  const from = data.totalMatching === 0 ? 0 : (filters.page - 1) * data.pageSize + 1;
  const to = Math.min(filters.page * data.pageSize, data.totalMatching);

  return (
    <ReportChrome
      title="Sales order details"
      description="Order-by-order register for this period."
      filters={filters}
      rangeStart={data.range.startYmd}
      rangeEnd={data.range.endYmd}
      communities={communities}
      communitiesEnabled={communitiesEnabled}
      basePath={BASE}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label="Total orders" value={String(summary.totalOrders)} />
        <SummaryCard label="Total sales" value={formatPrice(summary.totalSales)} />
        <SummaryCard label="Delivered sales" value={formatPrice(summary.deliveredSales)} />
        <SummaryCard label="Amount collected" value={formatPrice(summary.collected)} />
        <SummaryCard label="Outstanding amount" value={formatPrice(summary.outstanding)} />
      </div>

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="text-xl font-semibold">Orders</h2>
        {orders.length === 0 ? (
          <p className="mt-3 text-stone-600">No orders match these filters.</p>
        ) : (
          <>
            <div className="mt-3 space-y-3 md:hidden">
              {orders.map((order) => (
                <MobileOrderRowCard
                  key={order.id}
                  orderId={order.id}
                  orderNumber={order.order_number}
                  customerName={order.customer_name}
                  totalAmount={order.total_amount}
                  status={order.status}
                  paymentMethod={order.payment_method ?? 'pending'}
                  refundStatus={order.refund_status}
                  subtitle={`${paymentModeLabel(order.payment_method)} · ${orderChannelLabel(order.channel ?? 'app')}${
                    communitiesEnabled && order.community_name ? ` · ${order.community_name}` : ''
                  }`}
                  timeLabel="Placed"
                  timeValue={order.created_at}
                />
              ))}
            </div>
            <div className="hidden md:block">
              <TableScroll>
                <table className="mt-3 min-w-full text-left text-base">
                  <thead className="border-b border-stone-200">
                    <tr>
                      <ReportSortTh label="Order No" column="order_number" filters={filters} basePath={BASE} />
                      <ReportSortTh label="Customer" column="customer" filters={filters} basePath={BASE} />
                      <ReportSortTh label="Total" column="total" filters={filters} basePath={BASE} />
                      <ReportSortTh label="Order status" column="status" filters={filters} basePath={BASE} />
                      <ReportSortTh label="Payment" column="payment" filters={filters} basePath={BASE} />
                      <ReportSortTh label="Method" column="method" filters={filters} basePath={BASE} />
                      <ReportSortTh label="Channel" column="channel" filters={filters} basePath={BASE} />
                      {communitiesEnabled ? (
                        <ReportSortTh label="Community" column="community" filters={filters} basePath={BASE} />
                      ) : null}
                      <ReportSortTh label="Placed" column="placed" filters={filters} basePath={BASE} />
                      <ReportTh>
                        <span className="sr-only">View</span>
                      </ReportTh>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td className="px-3 py-2 font-semibold">{formatOrderNumber(order.order_number)}</td>
                        <td className="px-3 py-2">{order.customer_name}</td>
                        <td className="px-3 py-2">{formatPrice(order.total_amount)}</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="px-3 py-2">
                          <PaymentStatusBadge
                            status={order.status}
                            paymentMethod={order.payment_method}
                            refundStatus={order.refund_status}
                          />
                        </td>
                        <td className="px-3 py-2">{paymentModeLabel(order.payment_method)}</td>
                        <td className="px-3 py-2">{orderChannelLabel(order.channel ?? 'app')}</td>
                        {communitiesEnabled ? (
                          <td className="px-3 py-2">{order.community_name || '—'}</td>
                        ) : null}
                        <td className="px-3 py-2 text-stone-500">{formatDateTime(order.created_at)}</td>
                        <td className="px-3 py-2">
                          <Link href={`/orders/${order.id}`} className="font-medium text-emerald-800">
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-stone-600">
              <p>
                {from}–{to} of {data.totalMatching}
              </p>
              <div className="flex gap-2">
                {filters.page > 1 ? (
                  <Link
                    href={reportHref(BASE, { ...filters, page: filters.page - 1 })}
                    className="inline-flex min-h-10 items-center rounded-md border border-stone-300 px-3 font-medium text-stone-800"
                  >
                    Previous
                  </Link>
                ) : null}
                {filters.page < data.pageCount ? (
                  <Link
                    href={reportHref(BASE, { ...filters, page: filters.page + 1 })}
                    className="inline-flex min-h-10 items-center rounded-md border border-stone-300 px-3 font-medium text-stone-800"
                  >
                    Next
                  </Link>
                ) : null}
              </div>
            </div>
          </>
        )}
      </section>

      <ReportsItemLines lines={data.itemLines} />
    </ReportChrome>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-sm font-medium text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-stone-900">{value}</p>
    </div>
  );
}
