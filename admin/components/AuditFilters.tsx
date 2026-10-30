'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Spinner } from '@/components/ActionNotice';
import { AUDIT_APP_SOURCE_OPTIONS, AUDIT_ENTITY_OPTIONS, type AuditReportFilters } from '@/types/audit';

const fieldClass = 'min-h-10 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm';

type AuditPreset = AuditReportFilters['preset'];

const PRESETS: { value: AuditPreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom' },
];

function hrefFrom(next: AuditReportFilters) {
  const params = new URLSearchParams();
  if (next.preset !== '7d') {
    params.set('range', next.preset);
  }
  if (next.preset === 'custom') {
    params.set('from', next.fromYmd);
    params.set('to', next.toYmd);
  }
  if (next.entityType !== 'all') {
    params.set('entity', next.entityType);
  }
  if (next.appSource !== 'all') {
    params.set('app', next.appSource);
  }
  if (next.query) {
    params.set('q', next.query);
  }
  const qs = params.toString();
  return qs ? `/audit?${qs}` : '/audit';
}

export function AuditFilters({
  filters,
  rangeStart,
  rangeEnd,
}: {
  filters: AuditReportFilters;
  rangeStart: string;
  rangeEnd: string;
}) {
  const router = useRouter();
  const [view, setView] = useState(filters);
  const [applying, startTransition] = useTransition();

  function navigate(href: string) {
    startTransition(() => {
      router.push(href);
    });
  }

  function go(patch: Partial<AuditReportFilters>) {
    const next = { ...view, ...patch };
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
        {view.preset === 'custom' ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-stone-600">
              From
              <input name="from" type="date" defaultValue={rangeStart} className={`${fieldClass} mt-1 w-full`} />
            </label>
            <label className="block text-sm text-stone-600">
              To
              <input name="to" type="date" defaultValue={rangeEnd} className={`${fieldClass} mt-1 w-full`} />
            </label>
          </div>
        ) : null}
      </fieldset>

      <label className="block text-sm text-stone-600">
        Area
        <select
          className={`${fieldClass} mt-1 w-full`}
          value={view.entityType}
          onChange={(event) => go({ entityType: event.target.value as AuditReportFilters['entityType'] })}
        >
          {AUDIT_ENTITY_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm text-stone-600">
        App
        <select
          className={`${fieldClass} mt-1 w-full`}
          value={view.appSource}
          onChange={(event) => go({ appSource: event.target.value as AuditReportFilters['appSource'] })}
        >
          {AUDIT_APP_SOURCE_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm text-stone-600 lg:col-span-2">
        Search summary
        <input
          name="q"
          type="search"
          defaultValue={view.query}
          placeholder="Order number, product name, customer…"
          className={`${fieldClass} mt-1 w-full`}
        />
      </label>

      <div className="flex items-end lg:col-span-4">
        <button
          type="submit"
          className="min-h-10 rounded-lg bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800"
        >
          Apply
        </button>
      </div>
    </form>
  );
}
