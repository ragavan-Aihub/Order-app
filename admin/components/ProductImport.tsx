'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, type ChangeEvent } from 'react';

import { Spinner, useActionNotice } from '@/components/ActionNotice';
import { buildProductExportCsv, buildProductTemplateCsv } from '@/lib/product-catalog-csv';
import { importProductsFromCsv, type ProductImportIssue } from '@/services/product-actions';
import type { Product } from '@/types/product';

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ProductImport({
  categoriesEnabled = false,
  categoryNames = [],
  products = [],
}: {
  categoriesEnabled?: boolean;
  categoryNames?: string[];
  products?: Product[];
}) {
  const router = useRouter();
  const notice = useActionNotice();
  const template = useMemo(
    () => buildProductTemplateCsv(categoriesEnabled, categoryNames),
    [categoriesEnabled, categoryNames],
  );
  const catalogCsv = useMemo(
    () => buildProductExportCsv(products, categoriesEnabled),
    [categoriesEnabled, products],
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
      notice.show(`${result.created} product${result.created === 1 ? '' : 's'} imported`);
      router.refresh();
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-5">
      <h2 className="text-lg font-semibold">CSV import</h2>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-stone-600">
        <li>
          <span className="font-medium">Export template</span> has example rows for pcs, Kg, packs, and litres. Open it
          in Excel.
        </li>
        <li>
          <span className="font-medium">Export products</span> downloads every current product as one Excel row, with
          selling type, packs, weights, volumes, stock, and category.
        </li>
        <li>
          <span className="font-medium">selling_type</span> is <span className="font-medium">quantity</span>,{' '}
          <span className="font-medium">kg</span>, <span className="font-medium">liter</span>, or{' '}
          <span className="font-medium">fixed_pack</span>. Packs look like <span className="font-medium">100g=80;300g=220</span>.
          Weights/volumes look like <span className="font-medium">250;500;1kg</span>.
        </li>
        <li>
          <span className="font-medium">image_path</span> is a full path on this Mac for new imports. Exported rows leave
          it blank. Optional <span className="font-medium">available</span> / <span className="font-medium">active</span>{' '}
          are Yes/No.
        </li>
        {categoriesEnabled ? (
          <li>
            <span className="font-medium">category</span> is optional; use an active category name or leave blank.
          </li>
        ) : null}
        <li>Save as CSV, then import. Invalid rows are skipped. Import adds new products; it does not update existing ones.</li>
      </ol>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={() => downloadCsv('product-import-template.csv', template)}
          className="min-h-11 rounded-lg border border-emerald-800 px-4 font-semibold text-emerald-800"
        >
          Export template
        </button>
        <button
          type="button"
          onClick={() => downloadCsv('products-export.csv', catalogCsv)}
          disabled={products.length === 0}
          className="min-h-11 rounded-lg border border-stone-300 px-4 font-semibold text-stone-800 disabled:opacity-50"
        >
          Export products ({products.length})
        </button>
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-stone-300 bg-white px-4 text-sm font-medium text-stone-800">
          {file ? file.name : 'Choose CSV'}
          <input type="file" accept=".csv,text/csv,.xls,text/plain" onChange={onFileChange} className="sr-only" />
        </label>
        <button
          type="button"
          onClick={onImport}
          disabled={!file || saving}
          aria-busy={saving}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? <Spinner /> : null}
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
            <button type="button" onClick={() => downloadCsv('product-import-errors.csv', errorLogCsv)} className="text-sm font-semibold text-emerald-800">
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
