'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, type ChangeEvent } from 'react';

import { importProductsFromCsv, type ProductImportIssue } from '@/services/product-actions';

function buildTemplate(categoriesEnabled: boolean, categoryNames: string[]) {
  const sampleCategory =
    categoriesEnabled && categoryNames[0] ? categoryNames[0] : categoriesEnabled ? 'Pickles' : '';
  if (categoriesEnabled) {
    return `name,description,price,image_path,category
Mango pickle,Homemade pickle from farm mangoes,250,/Users/YOUR_NAME/Desktop/products/mango.jpg,${sampleCategory}
Mixed vegetable pickle,Seasonal mix,180,/Users/YOUR_NAME/Desktop/products/mixed.jpg,
`;
  }
  return `name,description,price,image_path
Mango pickle,Homemade pickle from farm mangoes,250,/Users/YOUR_NAME/Desktop/products/mango.jpg
Mixed vegetable pickle,Seasonal mix,180,/Users/YOUR_NAME/Desktop/products/mixed.jpg
`;
}

export function ProductImport({
  categoriesEnabled = false,
  categoryNames = [],
}: {
  categoriesEnabled?: boolean;
  categoryNames?: string[];
}) {
  const router = useRouter();
  const template = useMemo(
    () => buildTemplate(categoriesEnabled, categoryNames),
    [categoriesEnabled, categoryNames],
  );
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<number | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [errors, setErrors] = useState<ProductImportIssue[]>([]);
  const [errorLogCsv, setErrorLogCsv] = useState<string | null>(null);

  function resetResult() {
    setCreated(null);
    setSkipped(0);
    setErrors([]);
    setErrorLogCsv(null);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null;
    setFile(next);
    resetResult();
  }

  function downloadTemplate() {
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
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
      return;
    }
    setSaving(true);
    resetResult();
    const formData = new FormData();
    formData.set('file', file);
    formData.set('csv', await file.text());
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
      <ol className="list-decimal space-y-1 pl-5 text-sm text-stone-600">
        <li>Export the template and fill one row per product.</li>
        <li>
          <span className="font-medium">image_path</span> is a full path on this Mac (home folder). Imported items start
          as available — use the list toggle later.
        </li>
        {categoriesEnabled ? (
          <li>
            <span className="font-medium">category</span> is optional; use an active category name or leave blank.
          </li>
        ) : null}
        <li>Choose the CSV, then import. Invalid rows are skipped.</li>
      </ol>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={downloadTemplate}
          className="min-h-11 rounded-lg border border-emerald-800 px-4 font-semibold text-emerald-800"
        >
          Export template
        </button>
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-stone-300 bg-white px-4 text-sm font-medium text-stone-800">
          {file ? file.name : 'Choose CSV'}
          <input type="file" accept=".csv,text/csv" onChange={onFileChange} className="sr-only" />
        </label>
        <button
          type="button"
          onClick={onImport}
          disabled={!file || saving}
          className="min-h-11 rounded-lg bg-emerald-600 px-4 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? 'Importing…' : 'Import CSV'}
        </button>
      </div>
      {created != null ? (
        <p className={`text-sm ${created > 0 ? 'text-emerald-800' : 'text-stone-700'}`}>
          Imported {created}. Skipped {skipped}.
        </p>
      ) : null}
      {errors.length > 0 ? (
        <div className="space-y-2">
          {errorLogCsv ? (
            <button
              type="button"
              onClick={downloadErrorLog}
              className="text-sm font-semibold text-emerald-800"
            >
              Download error log
            </button>
          ) : null}
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
