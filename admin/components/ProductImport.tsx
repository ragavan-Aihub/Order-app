'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, type ChangeEvent } from 'react';

import { Spinner, useActionNotice } from '@/components/ActionNotice';
import { buildProductExportCsv, buildProductTemplateCsv } from '@/lib/product-catalog-csv';
import { importProductsFromCsv, type ProductImportIssue } from '@/services/product-actions';
import type { Product } from '@/types/product';

const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;
const CSV_EXT = /\.(csv|txt|xls)$/i;

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function splitImportFiles(list: FileList | null): { csv: File | null; images: File[] } {
  const files = Array.from(list ?? []);
  const csv =
    files.find((file) => CSV_EXT.test(file.name) || file.type.includes('csv') || file.type === 'text/plain') ?? null;
  const images = files.filter((file) => IMAGE_EXT.test(file.name) || file.type.startsWith('image/'));
  return { csv, images };
}

function selectionLabel(csv: File | null, images: File[]) {
  if (!csv && images.length === 0) {
    return 'Choose CSV + images';
  }
  const parts: string[] = [];
  if (csv) {
    parts.push(csv.name);
  }
  if (images.length > 0) {
    parts.push(`${images.length} image${images.length === 1 ? '' : 's'}`);
  }
  return parts.join(' · ');
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
  const [images, setImages] = useState<File[]>([]);
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

  function onFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const next = splitImportFiles(event.target.files);
    setFile(next.csv);
    setImages(next.images);
    resetResult();
    if (!next.csv && (event.target.files?.length ?? 0) > 0) {
      setErrors([{ row: 0, field: 'file', message: 'Include the CSV in the same selection as the images.' }]);
    }
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
    for (const image of images) {
      formData.append('images', image);
    }
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
          <span className="font-medium">image_path</span> should be the image file name (e.g.{' '}
          <span className="font-medium">kambu_dosa_mix.jpg</span>). Select the CSV and all product images together in
          one step. Local Mac full paths also work when admin runs on this computer.
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
        <label className="inline-flex min-h-11 max-w-full cursor-pointer items-center rounded-lg border border-stone-300 bg-white px-4 text-sm font-medium text-stone-800">
          <span className="truncate">{selectionLabel(file, images)}</span>
          <input
            type="file"
            accept=".csv,text/csv,.txt,.jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={onFilesChange}
            className="sr-only"
          />
        </label>
        <button
          type="button"
          onClick={onImport}
          disabled={!file || saving}
          aria-busy={saving}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? <Spinner /> : null}
          {saving ? 'Importing…' : 'Import'}
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
