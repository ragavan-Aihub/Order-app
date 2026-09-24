'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { importProductsFromCsv, type ProductImportIssue } from '@/services/product-actions';

const TEMPLATE = `name,description,price,available,image_path
Mango pickle,Homemade pickle from farm mangoes,250,Yes,/Users/YOUR_NAME/Desktop/products/mango.jpg
Mixed vegetable pickle,Seasonal mix,180,No,/Users/YOUR_NAME/Desktop/products/mixed.jpg
`;

export function ProductImport() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<number | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [errors, setErrors] = useState<ProductImportIssue[]>([]);
  const [errorLogCsv, setErrorLogCsv] = useState<string | null>(null);

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'product-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadErrorLog() {
    if (!errorLogCsv) {
      return;
    }
    const blob = new Blob([errorLogCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'product-import-errors.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function onImport() {
    if (!file) {
      setErrors([{ row: 0, field: 'file', message: 'Choose the filled CSV file.' }]);
      setCreated(null);
      setSkipped(0);
      setErrorLogCsv(null);
      return;
    }
    setSaving(true);
    setCreated(null);
    setSkipped(0);
    setErrors([]);
    setErrorLogCsv(null);
    const formData = new FormData();
    formData.set('file', file);
    const result = await importProductsFromCsv(formData);
    setSaving(false);
    setCreated(result.created);
    setSkipped(result.skipped);
    setErrors(result.errors);
    setErrorLogCsv(result.errorLogCsv);
    if (result.created > 0) {
      router.refresh();
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Import products</h2>
      <p className="text-sm text-stone-600">
        Download the template. <span className="font-medium">available</span> must be exactly <span className="font-medium">Yes</span> or{' '}
        <span className="font-medium">No</span>. Put <span className="font-medium">image_path</span> as a full path on this Mac
        (home folder). Valid rows are imported; invalid rows are skipped and listed in the error log.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={downloadTemplate}
          className="min-h-11 rounded-lg border border-emerald-800 px-4 font-semibold text-emerald-800"
        >
          Export template
        </button>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="min-h-11 max-w-full text-sm"
        />
        <button
          type="button"
          onClick={onImport}
          disabled={saving}
          className="min-h-11 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Importing…' : 'Import CSV'}
        </button>
      </div>
      {created != null ? (
        <p className="text-sm text-emerald-800">
          Imported {created}. Skipped {skipped}.
        </p>
      ) : null}
      {errors.length > 0 ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={downloadErrorLog}
            className="text-sm font-semibold text-emerald-800"
          >
            Download error log
          </button>
          <ul className="max-h-40 list-disc space-y-1 overflow-auto pl-5 text-sm text-red-700">
            {errors.map((error) => (
              <li key={`${error.row}-${error.field}-${error.message}`}>
                {error.row > 1 ? `Row ${error.row}, ${error.field}: ${error.message}` : error.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
