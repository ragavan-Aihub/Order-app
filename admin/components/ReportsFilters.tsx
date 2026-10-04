'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { Spinner } from '@/components/ActionNotice';
import type { CommunityListItem } from '@/types/community';
import { ORDER_STATUSES, PAYMENT_METHODS } from '@/types/order';
import { REPORT_CHANNELS, parseReportFilters, type ReportFilters, type ReportRangePreset } from '@/types/report';

const fieldClass = 'min-h-10 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm';

const PRESETS: { value: ReportRangePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom' },
];

function hrefFrom(next: ReportFilters) {
  const params = new URLSearchParams();
  if (next.preset !== '30d') {
    params.set('range', next.preset);
  }
  if (next.preset === 'custom') {
    params.set('from', next.fromYmd);
    params.set('to', next.toYmd);
  }
  if (next.status !== 'all') {
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
  const qs = params.toString();
  return qs ? `/reports?${qs}` : '/reports';
}

export function ReportsFilters({
  filters,
  rangeStart,
  rangeEnd,
  communities,
  communitiesEnabled,
}: {
  filters: ReportFilters;
  rangeStart: string;
  rangeEnd: string;
  communities: CommunityListItem[];
  communitiesEnabled: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState(filters);
  const [applying, startTransition] = useTransition();

  function navigate(href: string) {
    startTransition(() => {
      router.push(href);
    });
  }

  function go(patch: Partial<ReportFilters>) {
    const next = { ...view, page: 1, focusOutstanding: false, ...patch };
    setView(next);
    navigate(hrefFrom(next));
  }

  return (
    <form
      aria-busy={applying}
      className="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 md:grid-cols-2 lg:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        go({
          query: String(form.get('q') ?? '').trim(),
          fromYmd: String(form.get('from') ?? view.fromYmd),
          toYmd: String(form.get('to') ?? view.toYmd),
        });
      }}
    >
      <fieldset className="lg:col-span-4">
        <legend className="mb-2 flex w-full items-center justify-between gap-3 text-sm font-medium text-stone-600">
          <span>Date range</span>
          {applying ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-700" role="status">
              <Spinner size={14} /> Applying filter…
            </span>
          ) : null}
        </legend>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((item) => {
            const on = view.preset === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => go({ preset: item.value, fromYmd: rangeStart, toYmd: rangeEnd })}
                className={`min-h-10 rounded-full px-3 text-sm font-medium ${
                  on ? 'bg-emerald-700 text-white' : 'border border-stone-300 bg-white text-stone-700'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </fieldset>
      {view.preset === 'custom' ? (
        <>
          <label className="text-sm text-stone-600">
            From
            <input name="from" type="date" defaultValue={rangeStart} className={`${fieldClass} mt-1 w-full`} />
          </label>
          <label className="text-sm text-stone-600">
            To
            <input name="to" type="date" defaultValue={rangeEnd} className={`${fieldClass} mt-1 w-full`} />
          </label>
        </>
      ) : null}
      <label className="text-sm text-stone-600">
        Order status
        <select
          className={`${fieldClass} mt-1 w-full`}
          value={view.status}
          onChange={(event) => go({ status: event.target.value as ReportFilters['status'] })}
        >
          <option value="all">All</option>
          {ORDER_STATUSES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm text-stone-600">
        Payment status
        <select
          className={`${fieldClass} mt-1 w-full`}
          value={view.payment}
          onChange={(event) => go({ payment: event.target.value as ReportFilters['payment'] })}
        >
          <option value="all">All</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="outstanding">Outstanding</option>
          <option value="refunded">Refunded</option>
        </select>
      </label>
      <label className="text-sm text-stone-600">
        Payment method
        <select
          className={`${fieldClass} mt-1 w-full`}
          value={view.method}
          onChange={(event) => go({ method: event.target.value as ReportFilters['method'] })}
        >
          <option value="all">All</option>
          {PAYMENT_METHODS.filter((item) => item.value !== 'pending').map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm text-stone-600">
        Channel
        <select
          className={`${fieldClass} mt-1 w-full`}
          value={view.channel}
          onChange={(event) => go({ channel: event.target.value })}
        >
          <option value="">All</option>
          {REPORT_CHANNELS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      {communitiesEnabled ? (
        <label className="text-sm text-stone-600">
          Community
          <select
            className={`${fieldClass} mt-1 w-full`}
            value={view.communityId}
            onChange={(event) => go({ communityId: event.target.value })}
          >
            <option value="">All communities</option>
            {communities.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="text-sm text-stone-600 lg:col-span-2">
        Customer
        <input
          name="q"
          defaultValue={filters.query}
          placeholder="Name or phone"
          className={`${fieldClass} mt-1 w-full`}
        />
      </label>
      <div className="flex flex-wrap items-end gap-2">
        <button
          type="submit"
          className="inline-flex min-h-10 items-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={() => {
            setView(parseReportFilters({}));
            navigate('/reports');
          }}
          className="inline-flex min-h-10 items-center rounded-md border border-stone-300 px-4 text-sm font-medium text-stone-700"
        >
          Reset filters
        </button>
      </div>
    </form>
  );
}

export function ScrollToOutstanding({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) {
      return;
    }
    document.getElementById('outstanding')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [active]);
  return null;
}
