export type ReportSortDir = 'asc' | 'desc';

export function compareSortValues(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
): number {
  if (a == null && b == null) {
    return 0;
  }
  if (a == null) {
    return 1;
  }
  if (b == null) {
    return -1;
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  return String(a).localeCompare(String(b), 'en-IN', { numeric: true, sensitivity: 'base' });
}

export function sortReportRows<T>(
  rows: T[],
  column: string | undefined,
  dir: ReportSortDir,
  accessors: Record<string, (row: T) => string | number | null | undefined>,
): T[] {
  if (!column || !accessors[column]) {
    return rows;
  }
  const valueOf = accessors[column];
  const mul = dir === 'asc' ? 1 : -1;
  return [...rows].sort((left, right) => mul * compareSortValues(valueOf(left), valueOf(right)));
}
