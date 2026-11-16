import Link from 'next/link';

import { REPORT_CATALOG } from '@/lib/report-catalog';

export const dynamic = 'force-dynamic';

export default function ReportsHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold md:text-4xl">Reports</h1>
        <p className="mt-1 text-lg text-stone-600">Choose a report. Each one uses the same date range and filters.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {REPORT_CATALOG.map((report) => (
          <Link
            key={report.href}
            href={report.href}
            className="rounded-xl border border-stone-200 bg-white p-5 hover:border-emerald-300 hover:shadow-sm"
          >
            <h2 className="text-xl font-semibold text-stone-900">{report.title}</h2>
            <p className="mt-2 text-base text-stone-600">{report.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
