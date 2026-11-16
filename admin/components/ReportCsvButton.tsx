'use client';

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function ReportCsvButton({
  filename,
  header,
  rows,
}: {
  filename: string;
  header: string[];
  rows: string[][];
}) {
  function exportCsv() {
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={exportCsv}
      className="inline-flex min-h-11 items-center rounded-md border border-stone-300 px-3 text-base font-medium text-stone-800"
    >
      Export CSV
    </button>
  );
}
