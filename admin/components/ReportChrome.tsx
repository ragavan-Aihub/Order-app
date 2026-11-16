import Link from 'next/link';
import type { ReactNode } from 'react';

import { ReportsFilters } from '@/components/ReportsFilters';
import type { CommunityListItem } from '@/types/community';
import type { ReportFilterParseOptions, ReportFilters } from '@/types/report';

export function ReportChrome({
  title,
  description,
  filters,
  rangeStart,
  rangeEnd,
  communities,
  communitiesEnabled,
  basePath,
  parseOptions,
  hidePayment,
  actions,
  children,
}: {
  title: string;
  description: string;
  filters: ReportFilters;
  rangeStart: string;
  rangeEnd: string;
  communities: CommunityListItem[];
  communitiesEnabled: boolean;
  basePath: string;
  parseOptions?: ReportFilterParseOptions;
  hidePayment?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6 text-base">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/reports" className="text-base font-medium text-stone-500 hover:text-emerald-700">
            ← Reports
          </Link>
          <h1 className="mt-1 text-3xl font-bold md:text-4xl">{title}</h1>
          <p className="mt-1 text-lg text-stone-600">{description}</p>
        </div>
        {actions}
      </div>
      <ReportsFilters
        filters={filters}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        communities={communities}
        communitiesEnabled={communitiesEnabled}
        basePath={basePath}
        parseOptions={parseOptions}
        hidePayment={hidePayment}
      />
      {children}
    </div>
  );
}

export function ReportLoadError({ message }: { message: string }) {
  return (
    <div className="space-y-4">
      <Link href="/reports" className="text-sm font-medium text-stone-500 hover:text-emerald-700">
        ← Reports
      </Link>
      <div className="rounded-xl border border-red-200 bg-white p-5 text-stone-700">
        <p className="font-medium text-red-800">Could not load this report.</p>
        <p className="mt-1 text-sm">{message}</p>
      </div>
    </div>
  );
}
