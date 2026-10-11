import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BellRing,
  CircleCheck,
  CircleAlert,
  IndianRupee,
  PackageCheck,
  ShoppingBag,
  Truck,
  UserRoundPen,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { PaymentStatusBadge, StatusBadge } from '@/components/OrderBadges';
import { TableScroll } from '@/components/TableScroll';
import { getDashboardData } from '@/services/reports';
import { formatDateTime, formatOrderNumber, formatPrice } from '@/utils/format';

export const dynamic = 'force-dynamic';

const IST = 'Asia/Kolkata';

function istGreeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: IST }).format(new Date()),
  );
  if (hour < 12) {
    return 'Good morning';
  }
  if (hour < 17) {
    return 'Good afternoon';
  }
  return 'Good evening';
}

function istTodayLabel(): string {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: IST,
  }).format(new Date());
}

type Tone = 'teal' | 'emerald' | 'indigo' | 'amber';

const TONES: Record<Tone, string> = {
  teal: 'bg-teal-50 text-teal-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  indigo: 'bg-indigo-50 text-indigo-700',
  amber: 'bg-amber-100 text-amber-800',
};

function KpiCard({
  label,
  value,
  hint,
  footer,
  href,
  icon: Icon,
  tone,
  attention = false,
}: {
  label: string;
  value: string;
  hint?: string;
  footer?: ReactNode;
  href?: string;
  icon: LucideIcon;
  tone: Tone;
  attention?: boolean;
}) {
  const card = (
    <div
      className={`h-full rounded-2xl border bg-white p-4 shadow-sm transition-shadow ${
        attention ? 'border-amber-300 ring-1 ring-amber-200' : 'border-stone-200'
      } ${href ? 'hover:shadow-md' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${TONES[tone]}`} aria-hidden>
          <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
        </span>
      </div>
      <p
        className={`mt-3 text-3xl font-semibold tabular-nums tracking-tight ${
          attention ? 'text-amber-800' : 'text-stone-900'
        }`}
      >
        {value}
      </p>
      {hint ? (
        <p className={`mt-1.5 text-sm ${attention ? 'font-medium text-amber-800' : 'text-stone-500'}`}>{hint}</p>
      ) : null}
      {footer ? <div className="mt-1.5">{footer}</div> : null}
    </div>
  );
  if (!href) {
    return card;
  }
  return (
    <Link
      href={href}
      className="block rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
    >
      {card}
    </Link>
  );
}

function OrdersTrend({ today, yesterday }: { today: number; yesterday: number }) {
  const diff = today - yesterday;
  const chip =
    diff > 0
      ? { Icon: ArrowUp, text: String(diff), cls: 'bg-emerald-50 text-emerald-700' }
      : diff < 0
        ? { Icon: ArrowDown, text: String(Math.abs(diff)), cls: 'bg-rose-50 text-rose-700' }
        : null;
  return (
    <p className="flex items-center gap-2 text-sm text-stone-500">
      {chip ? (
        <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${chip.cls}`}>
          <chip.Icon className="h-3 w-3" strokeWidth={2.5} aria-hidden />
          {chip.text}
        </span>
      ) : null}
      <span>{yesterday} yesterday</span>
    </p>
  );
}

export default async function DashboardPage() {
  const result = await getDashboardData();

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold md:text-3xl">Dashboard</h1>
        <div className="rounded-xl border border-red-200 bg-white p-5 text-stone-700">
          <p className="font-medium text-red-800">Could not load today’s figures.</p>
          <p className="mt-1 text-sm">{result.message}</p>
          <Link href="/" className="mt-3 inline-block font-medium text-emerald-800">
            Try again
          </Link>
        </div>
      </div>
    );
  }

  const data = result.data;
  const outstandingHref = '/reports?range=30d&status=delivered&payment=outstanding&focus=outstanding';
  const pendingDeliveryHref = '/orders?view=pending_delivery';
  const customerModifiedHref = '/orders?view=customer_modified_after_confirm';
  const insightWarns = data.outstandingCount > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">{istGreeting()}</h1>
          <p className="mt-1 text-stone-600">What needs your attention today</p>
        </div>
        <p className="text-sm font-medium text-stone-500">{istTodayLabel()}</p>
      </div>

      {data.placedCount > 0 ? (
        <Link
          href="/orders?status=new"
          className="group flex items-center gap-3 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-800" aria-hidden>
            <BellRing className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-teal-900">
              {data.placedCount} {data.placedCount === 1 ? 'order is' : 'orders are'} waiting to be confirmed
            </span>
            <span className="block text-sm text-teal-800">Confirm them so customers know they are on the way.</span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-teal-900">
            <span className="hidden sm:inline">Review orders</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </Link>
      ) : null}

      {data.customerModifiedAfterConfirmCount > 0 ? (
        <Link
          href={customerModifiedHref}
          className="group flex items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-800" aria-hidden>
            <UserRoundPen className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-sky-900">
              {data.customerModifiedAfterConfirmCount}{' '}
              {data.customerModifiedAfterConfirmCount === 1 ? 'order was' : 'orders were'} changed by the customer after
              confirm
            </span>
            <span className="block text-sm text-sky-800">Review line changes before you send them out.</span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-sky-900">
            <span className="hidden sm:inline">View orders</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </Link>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard
          label="Orders today"
          value={String(data.ordersToday)}
          icon={ShoppingBag}
          tone="teal"
          footer={
            data.showYesterdayCompare ? <OrdersTrend today={data.ordersToday} yesterday={data.ordersYesterday} /> : null
          }
        />
        <KpiCard label="Sales today" value={formatPrice(data.salesToday)} icon={IndianRupee} tone="emerald" />
        <KpiCard
          label="Pending deliveries"
          value={String(data.pendingDeliveryCount)}
          hint="Placed + confirmed"
          href={pendingDeliveryHref}
          icon={Truck}
          tone="teal"
          attention={data.pendingDeliveryCount > 0}
        />
        <KpiCard label="Delivered today" value={String(data.deliveredToday)} icon={PackageCheck} tone="indigo" />
        <KpiCard
          label="Outstanding"
          value={formatPrice(data.outstandingAmount)}
          hint={`${data.outstandingCount} unpaid delivered ${data.outstandingCount === 1 ? 'order' : 'orders'}`}
          href={outstandingHref}
          icon={Wallet}
          tone="amber"
          attention={data.outstandingCount > 0}
        />
      </div>

      <p
        className={`flex items-center gap-2.5 rounded-2xl border-l-4 px-4 py-3 text-sm font-medium ${
          insightWarns
            ? 'border-amber-400 bg-amber-50 text-amber-900'
            : 'border-emerald-500 bg-emerald-50 text-emerald-900'
        }`}
      >
        {insightWarns ? (
          <CircleAlert className="h-[18px] w-[18px] shrink-0" aria-hidden />
        ) : (
          <CircleCheck className="h-[18px] w-[18px] shrink-0" aria-hidden />
        )}
        {data.insight}
      </p>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Recent orders</h2>
          <Link href="/orders" className="inline-flex items-center gap-1 font-medium text-emerald-800 hover:underline">
            All orders
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        {data.recent.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-stone-600">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-500" aria-hidden>
              <ShoppingBag className="h-6 w-6" />
            </span>
            <p className="font-medium text-stone-800">No orders yet</p>
            <p className="text-sm">New orders will show up here.</p>
          </div>
        ) : (
          <TableScroll>
            <table className="min-w-full text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="rounded-l-lg px-3 py-2 font-semibold">Order</th>
                  <th className="px-3 py-2 font-semibold">Customer</th>
                  <th className="px-3 py-2 font-semibold">Total</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Payment</th>
                  <th className="px-3 py-2 font-semibold">Placed</th>
                  <th className="rounded-r-lg px-3 py-2 font-semibold">
                    <span className="sr-only">View</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {data.recent.map((order) => (
                  <tr key={order.id} className="transition-colors hover:bg-stone-50">
                    <td className="px-3 py-2.5 font-semibold text-emerald-900">
                      {formatOrderNumber(order.order_number)}
                      {order.admin_modified_from_placed ? (
                        <span className="ml-2 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-950">
                          Shop
                        </span>
                      ) : null}
                      {order.customer_modified_after_confirm ? (
                        <span className="ml-2 rounded-full bg-sky-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-950">
                          Customer
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-2">
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold uppercase text-emerald-800"
                          aria-hidden
                        >
                          {order.customer_name?.trim().charAt(0) || '?'}
                        </span>
                        <span className="font-medium text-stone-800">{order.customer_name}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{formatPrice(order.total_amount)}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-3 py-2.5">
                      <PaymentStatusBadge
                        status={order.status}
                        paymentMethod={order.payment_method}
                        refundStatus={order.refund_status}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-stone-500">{formatDateTime(order.created_at)}</td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/orders/${order.id}`}
                        className="inline-flex items-center gap-1 font-medium text-emerald-800 hover:underline"
                      >
                        View
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </section>
    </div>
  );
}
