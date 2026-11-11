'use client';

import {
  ClipboardPaste,
  ImagePlus,
  Info,
  Plus,
  Upload,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent } from 'react';

import { Spinner, useActionNotice } from '@/components/ActionNotice';
import {
  fileFromClipboardEvent,
  readImageFromNavigatorClipboard,
  readImageFromNextPaste,
} from '@/lib/pasted-image';
import {
  formatVolume,
  formatWeight,
  type SellingType,
  VOLUME_PRESETS_ML,
  volumeOptionPrice,
  WEIGHT_PRESETS_GRAMS,
  weightOptionPrice,
} from '@/lib/selling-units';
import { saveProduct } from '@/services/product-actions';
import { ProductDeleteButton } from '@/components/ProductDeleteButton';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DESCRIPTION_MAX = 500;
const NAME_MAX = 120;
const PRICE_MAX = 9_999_999.99;

const fieldClass =
  'min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20';

type ProductFormProps = {
  product?: {
    id: string;
    name: string;
    description: string;
    price: number;
    selling_type?: SellingType;
    selling_unit?: string | null;
    price_per_kg?: number | null;
    price_per_liter?: number | null;
    weightOptions?: Array<{
      id: string;
      weight_grams: number;
      is_active: boolean;
      display_order: number;
    }>;
    volumeOptions?: Array<{
      id: string;
      volume_ml: number;
      is_active: boolean;
      display_order: number;
    }>;
    packs?: Array<{
      id: string;
      weight_grams: number;
      selling_price: number;
      is_active: boolean;
      display_order: number;
    }>;
    image_url: string | null;
    category_id?: string | null;
    transacted?: boolean;
  };
  categoriesEnabled?: boolean;
  categories?: Array<{ id: string; name: string }>;
};

function safePreviewSrc(url: string): string {
  if (!url) {
    return '';
  }
  if (url.startsWith('blob:')) {
    return url;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return url;
    }
  } catch {
    return '';
  }
  return '';
}

export function ProductForm({ product, categoriesEnabled = false, categories = [] }: ProductFormProps) {
  const router = useRouter();
  const notice = useActionNotice();
  const isEdit = Boolean(product);
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [sellingType, setSellingType] = useState<SellingType>(product?.selling_type ?? 'quantity');
  const initialPrice =
    product?.selling_type === 'kg' && product.price_per_kg != null
      ? product.price_per_kg
      : product?.selling_type === 'liter' && product.price_per_liter != null
        ? product.price_per_liter
        : product?.price;
  const [price, setPrice] = useState(initialPrice != null ? Number(initialPrice).toFixed(2) : '');
  const [weights, setWeights] = useState<Array<{ id?: string; weight_grams: number; is_active: boolean }>>(
    () =>
      product?.weightOptions?.map((row) => ({
        id: row.id,
        weight_grams: row.weight_grams,
        is_active: row.is_active,
      })) ?? [],
  );
  const [customGrams, setCustomGrams] = useState('');

  function togglePresetWeight(grams: number) {
    setWeights((current) => {
      const found = current.find((row) => row.weight_grams === grams);
      if (!found) {
        return [...current, { weight_grams: grams, is_active: true }];
      }
      return current.map((row) => (row.weight_grams === grams ? { ...row, is_active: !row.is_active } : row));
    });
  }

  function addCustomWeight() {
    const grams = Number(customGrams);
    if (!Number.isInteger(grams) || grams < 1 || grams > 100_000) {
      setError('Enter a whole number of grams between 1 and 100000.');
      return;
    }
    setError(null);
    setWeights((current) =>
      current.some((row) => row.weight_grams === grams)
        ? current.map((row) => (row.weight_grams === grams ? { ...row, is_active: true } : row))
        : [...current, { weight_grams: grams, is_active: true }],
    );
    setCustomGrams('');
  }
  const [volumes, setVolumes] = useState<Array<{ id?: string; volume_ml: number; is_active: boolean }>>(
    () =>
      product?.volumeOptions?.map((row) => ({
        id: row.id,
        volume_ml: row.volume_ml,
        is_active: row.is_active,
      })) ?? [],
  );
  const [customMl, setCustomMl] = useState('');

  function togglePresetVolume(ml: number) {
    setVolumes((current) => {
      const found = current.find((row) => row.volume_ml === ml);
      if (!found) {
        return [...current, { volume_ml: ml, is_active: true }];
      }
      return current.map((row) => (row.volume_ml === ml ? { ...row, is_active: !row.is_active } : row));
    });
  }

  function addCustomVolume() {
    const ml = Number(customMl);
    if (!Number.isInteger(ml) || ml < 1 || ml > 100_000) {
      setError('Enter a whole number of ml between 1 and 100000.');
      return;
    }
    setError(null);
    setVolumes((current) =>
      current.some((row) => row.volume_ml === ml)
        ? current.map((row) => (row.volume_ml === ml ? { ...row, is_active: true } : row))
        : [...current, { volume_ml: ml, is_active: true }],
    );
    setCustomMl('');
  }
  const [packs, setPacks] = useState<
    Array<{ id?: string; weight_grams: string; selling_price: string; is_active: boolean }>
  >(
    () =>
      product?.packs?.map((pack) => ({
        id: pack.id,
        weight_grams: String(pack.weight_grams),
        selling_price: Number(pack.selling_price).toFixed(2),
        is_active: pack.is_active,
      })) ?? [{ weight_grams: '100', selling_price: '', is_active: true }],
  );
  const [categoryId, setCategoryId] = useState(product?.category_id ?? '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(safePreviewSrc(product?.image_url ?? ''));
  const [imageRemoved, setImageRemoved] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const dragCount = useRef(0);
  const previewRef = useRef(imagePreview);
  previewRef.current = imagePreview;

  useEffect(() => {
    return () => {
      if (previewRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(previewRef.current);
      }
    };
  }, []);

  function applyImage(file: File) {
    if (!ALLOWED_TYPES.has(file.type)) {
      setImageError('Use a JPG, PNG, WebP, or GIF image.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError('Image must be 5 MB or smaller.');
      return;
    }
    setImageError(null);
    setError(null);
    if (imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(file);
    setImageRemoved(false);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImage() {
    if (imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview('');
    setImageRemoved(true);
    setImageError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function onDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragCount.current += 1;
    setDragging(true);
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragCount.current = Math.max(0, dragCount.current - 1);
    if (dragCount.current === 0) {
      setDragging(false);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragCount.current = 0;
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      applyImage(file);
    }
  }

  function onPasteImage(event: ClipboardEvent<HTMLDivElement>) {
    const file = fileFromClipboardEvent(event.nativeEvent);
    if (!file) {
      return;
    }
    event.preventDefault();
    applyImage(file);
  }

  function onPasteImageButton() {
    setImageError(null);
    const readPromise =
      typeof navigator !== 'undefined' && navigator.clipboard?.read
        ? navigator.clipboard.read()
        : null;
    void readImageFromNavigatorClipboard(readPromise).then(async (file) => {
      if (file) {
        applyImage(file);
        return;
      }
      dropZoneRef.current?.focus();
      const pasted = await readImageFromNextPaste();
      if (pasted) {
        applyImage(pasted);
        return;
      }
      setImageError('Could not read clipboard. Click the dashed box, then paste (⌘V / Ctrl+V), or choose a file.');
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setImageError(null);

    if (sellingType === 'kg' && !weights.some((row) => row.is_active)) {
      setError('Add at least one weight option for this Kg product.');
      return;
    }
    if (sellingType === 'liter' && !volumes.some((row) => row.is_active)) {
      setError('Add at least one volume option for this Liter product.');
      return;
    }

    const priceValue = Number(price);
    if (
      sellingType !== 'fixed_pack' &&
      (!Number.isFinite(priceValue) || priceValue < 0 || priceValue > PRICE_MAX)
    ) {
      setError('Enter a valid price.');
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    if (product) {
      formData.set('id', product.id);
    }
    formData.set('name', name.trim());
    formData.set('description', description.trim().slice(0, DESCRIPTION_MAX));
    formData.set('selling_type', sellingType);
    formData.set('price', price);
    formData.set(
      'volumes',
      JSON.stringify(
        [...volumes]
          .sort((a, b) => a.volume_ml - b.volume_ml)
          .map((row, index) => ({ ...row, display_order: index })),
      ),
    );
    formData.set(
      'weights',
      JSON.stringify(
        [...weights]
          .sort((a, b) => a.weight_grams - b.weight_grams)
          .map((row, index) => ({ ...row, display_order: index })),
      ),
    );
    formData.set(
      'packs',
      JSON.stringify(
        packs.map((pack, index) => ({
          id: pack.id,
          weight_grams: Number(pack.weight_grams),
          selling_price: Number(pack.selling_price),
          is_active: pack.is_active,
          display_order: index,
        })),
      ),
    );
    if (categoriesEnabled) {
      formData.set('category_id', categoryId);
    }
    if (imageRemoved && !imageFile) {
      formData.set('image_removed', '1');
    }
    if (imageFile) {
      formData.set('image', imageFile);
    }

    const result = await saveProduct(formData);
    if (result.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    notice.show(isEdit ? 'Product saved' : 'Product added');
    router.replace('/products');
    router.refresh();
  }

  const hasPreview = Boolean(imagePreview);

  return (
    <form onSubmit={onSubmit} autoComplete="off" className="max-w-3xl space-y-5">
      <section className="rounded-2xl border border-stone-200 bg-white p-5 md:p-6">
        <h2 className="text-base font-semibold">Product image</h2>
        <p className="mt-1 text-sm text-stone-500">
          Optional. Shown in the customer app when set. JPG, PNG, WebP, or GIF, up to 5 MB.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              applyImage(file);
            }
          }}
        />

        <div className={`mt-4 grid gap-5 ${hasPreview ? 'md:grid-cols-[minmax(0,1fr)_16rem]' : ''}`}>
          <div
            ref={dropZoneRef}
            role="group"
            aria-label="Product image"
            tabIndex={0}
            onDragEnter={onDragEnter}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onPaste={onPasteImage}
            className={`flex min-h-[11.5rem] flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
              dragging
                ? 'border-emerald-500 bg-emerald-100/80'
                : 'border-emerald-200 bg-emerald-50/70'
            }`}
          >
            <Upload className="h-8 w-8 text-emerald-600" strokeWidth={1.75} aria-hidden />
            <p className="mt-3 text-sm font-medium text-stone-800">Drag and drop an image here</p>
            <p className="mt-1 text-xs text-stone-400">or</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-emerald-600 bg-white px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                <ImagePlus className="h-4 w-4" aria-hidden />
                Choose image
              </button>
              <button
                type="button"
                onClick={() => void onPasteImageButton()}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50"
              >
                <ClipboardPaste className="h-4 w-4" aria-hidden />
                Paste image
              </button>
            </div>
            <p className="mt-3 text-xs text-stone-500">
              Click this box, then paste (⌘V / Ctrl+V), or use Paste image.
            </p>
            <p className="mt-1 text-xs text-stone-400">JPG, PNG, WebP, or GIF · Max 5 MB</p>
          </div>

          {hasPreview ? (
            <div className="min-w-0">
              <p className="mb-2 text-xs font-medium text-stone-500">Preview</p>
              <div className="relative overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="Product preview" className="aspect-[4/3] w-full object-cover" />
                <button
                  type="button"
                  onClick={clearImage}
                  aria-label="Remove image"
                  className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-stone-600 shadow-sm hover:bg-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
        {imageError ? <p className="mt-3 text-sm text-red-700">{imageError}</p> : null}
      </section>

      <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 md:p-6">
        <h2 className="text-base font-semibold">Details</h2>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">
            Product name <span className="text-red-500">*</span>
          </span>
          <input
            required
            maxLength={NAME_MAX}
            value={name}
            onChange={(event) => setName(event.target.value.slice(0, NAME_MAX))}
            placeholder="e.g. Fresh Tomatoes"
            className={fieldClass}
          />
        </label>

        {categoriesEnabled ? (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">Category (optional)</span>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className={fieldClass}
            >
              <option value="">No category</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">Description</span>
          <div className="relative">
            <textarea
              value={description}
              maxLength={DESCRIPTION_MAX}
              onChange={(event) => setDescription(event.target.value.slice(0, DESCRIPTION_MAX))}
              placeholder="e.g. Fresh, farm-grown tomatoes sourced from local farmers."
              rows={3}
              className={`${fieldClass} min-h-[6.5rem] resize-y pb-7`}
            />
            <span className="pointer-events-none absolute bottom-2 right-3 text-xs text-stone-400">
              {description.length}/{DESCRIPTION_MAX}
            </span>
          </div>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">
            Selling type <span className="text-red-500">*</span>
          </span>
          <select
            value={sellingType}
            onChange={(event) => setSellingType(event.target.value as SellingType)}
            className={fieldClass}
          >
            <option value="quantity">Qty (count)</option>
            <option value="kg">Kg (customer picks a weight option)</option>
            <option value="liter">Liter (customer picks a volume option)</option>
            <option value="fixed_pack">Fixed pack (100g, 250g, …)</option>
          </select>
        </label>

        <div className="grid gap-4 sm:max-w-sm">
          {sellingType !== 'fixed_pack' ? (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">
              {sellingType === 'kg' ? 'Price per Kg (₹)' : sellingType === 'liter' ? 'Price per Liter (₹)' : 'Price (₹)'}{' '}
              <span className="text-red-500">*</span>
            </span>
            <div className="flex min-h-11 overflow-hidden rounded-lg border border-stone-300 bg-white focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
              <span className="flex items-center border-r border-stone-200 bg-stone-50 px-3 text-sm font-medium text-stone-500">
                ₹
              </span>
              <input
                required
                type="number"
                min="0"
                max={PRICE_MAX}
                step="0.01"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="0.00"
                className="min-h-11 w-full border-0 bg-transparent px-3 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none"
              />
            </div>
          </label>
          ) : null}
        </div>

        {sellingType === 'kg' ? (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-stone-700">Weight options</p>
              <p className="mt-0.5 text-xs text-stone-500">
                Customers choose one of these weights, then a quantity. Each option costs price per Kg × weight.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {WEIGHT_PRESETS_GRAMS.map((grams) => {
                const on = weights.some((row) => row.weight_grams === grams && row.is_active);
                return (
                  <button
                    key={grams}
                    type="button"
                    aria-pressed={on}
                    onClick={() => togglePresetWeight(grams)}
                    className={`min-h-10 rounded-full border px-4 text-sm font-semibold ${
                      on
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    {formatWeight(grams)}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="block text-xs text-stone-500">
                Custom weight (g)
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={customGrams}
                  onChange={(event) => setCustomGrams(event.target.value)}
                  placeholder="e.g. 750"
                  className={`${fieldClass} mt-1 min-h-10 w-36`}
                />
              </label>
              <button
                type="button"
                onClick={addCustomWeight}
                className="min-h-10 rounded-lg border border-emerald-600 px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                Add weight
              </button>
            </div>
            {weights.length > 0 ? (
              <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
                {[...weights]
                  .sort((a, b) => a.weight_grams - b.weight_grams)
                  .map((row) => {
                    const perKg = Number(price);
                    return (
                      <li key={row.weight_grams} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                        <span className="w-20 font-semibold text-stone-900">{formatWeight(row.weight_grams)}</span>
                        <span className="w-24 text-stone-600">
                          {Number.isFinite(perKg) && perKg > 0
                            ? `₹${weightOptionPrice(perKg, row.weight_grams)}`
                            : '—'}
                        </span>
                        <label className="flex items-center gap-2 text-stone-700">
                          <input
                            type="checkbox"
                            checked={row.is_active}
                            onChange={(event) =>
                              setWeights((current) =>
                                current.map((item) =>
                                  item.weight_grams === row.weight_grams
                                    ? { ...item, is_active: event.target.checked }
                                    : item,
                                ),
                              )
                            }
                          />
                          Active
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setWeights((current) => current.filter((item) => item.weight_grams !== row.weight_grams))
                          }
                          className="ml-auto text-sm font-medium text-red-700 hover:underline"
                        >
                          Remove
                        </button>
                      </li>
                    );
                  })}
              </ul>
            ) : (
              <p className="text-xs text-amber-700">No weight options yet. Customers cannot order this product.</p>
            )}
          </div>
        ) : null}

        {sellingType === 'liter' ? (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-stone-700">Volume options</p>
              <p className="mt-0.5 text-xs text-stone-500">
                Customers choose one of these volumes, then a quantity. Each option costs price per Liter × volume.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {VOLUME_PRESETS_ML.map((ml) => {
                const on = volumes.some((row) => row.volume_ml === ml && row.is_active);
                return (
                  <button
                    key={ml}
                    type="button"
                    aria-pressed={on}
                    onClick={() => togglePresetVolume(ml)}
                    className={`min-h-10 rounded-full border px-4 text-sm font-semibold ${
                      on
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    {formatVolume(ml)}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="block text-xs text-stone-500">
                Custom volume (ml)
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={customMl}
                  onChange={(event) => setCustomMl(event.target.value)}
                  placeholder="e.g. 750"
                  className={`${fieldClass} mt-1 min-h-10 w-36`}
                />
              </label>
              <button
                type="button"
                onClick={addCustomVolume}
                className="min-h-10 rounded-lg border border-emerald-600 px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                Add volume
              </button>
            </div>
            {volumes.length > 0 ? (
              <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
                {[...volumes]
                  .sort((a, b) => a.volume_ml - b.volume_ml)
                  .map((row) => {
                    const perL = Number(price);
                    return (
                      <li key={row.volume_ml} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                        <span className="w-20 font-semibold text-stone-900">{formatVolume(row.volume_ml)}</span>
                        <span className="w-24 text-stone-600">
                          {Number.isFinite(perL) && perL > 0 ? `₹${volumeOptionPrice(perL, row.volume_ml)}` : '—'}
                        </span>
                        <label className="flex items-center gap-2 text-stone-700">
                          <input
                            type="checkbox"
                            checked={row.is_active}
                            onChange={(event) =>
                              setVolumes((current) =>
                                current.map((item) =>
                                  item.volume_ml === row.volume_ml
                                    ? { ...item, is_active: event.target.checked }
                                    : item,
                                ),
                              )
                            }
                          />
                          Active
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setVolumes((current) => current.filter((item) => item.volume_ml !== row.volume_ml))
                          }
                          className="ml-auto text-sm font-medium text-red-700 hover:underline"
                        >
                          Remove
                        </button>
                      </li>
                    );
                  })}
              </ul>
            ) : (
              <p className="text-xs text-amber-700">No volume options yet. Customers cannot order this product.</p>
            )}
          </div>
        ) : null}

        {sellingType === 'fixed_pack' ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-stone-700">Pack options</p>
            {packs.map((pack, index) => (
              <div key={pack.id ?? `new-${index}`} className="grid gap-2 rounded-lg border border-stone-200 p-3 sm:grid-cols-[7rem_7rem_auto_auto]">
                <label className="block text-xs text-stone-500">
                  Weight (g)
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={pack.weight_grams}
                    onChange={(event) =>
                      setPacks((current) =>
                        current.map((row, i) => (i === index ? { ...row, weight_grams: event.target.value } : row)),
                      )
                    }
                    className={`${fieldClass} mt-1 min-h-10`}
                  />
                </label>
                <label className="block text-xs text-stone-500">
                  Selling price (₹)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={pack.selling_price}
                    onChange={(event) =>
                      setPacks((current) =>
                        current.map((row, i) => (i === index ? { ...row, selling_price: event.target.value } : row)),
                      )
                    }
                    className={`${fieldClass} mt-1 min-h-10`}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-stone-700 sm:mt-6">
                  <input
                    type="checkbox"
                    checked={pack.is_active}
                    onChange={(event) =>
                      setPacks((current) =>
                        current.map((row, i) => (i === index ? { ...row, is_active: event.target.checked } : row)),
                      )
                    }
                  />
                  Active
                </label>
                <button
                  type="button"
                  onClick={() => setPacks((current) => current.filter((_, i) => i !== index))}
                  className="text-sm font-medium text-red-700 hover:underline sm:mt-6"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setPacks((current) => [...current, { weight_grams: '', selling_price: '', is_active: true }])
              }
              className="text-sm font-semibold text-emerald-700 hover:underline"
            >
              Add pack option
            </button>
          </div>
        ) : null}

        <p className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {isEdit
            ? 'Use the products list for Active/Inactive and Available/Coming soon. Ordered products can be set Inactive but not deleted.'
            : 'New products start as Active and Available. Change those from the products list.'}
        </p>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-emerald-700 px-4 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Spinner /> Saving…
              </>
            ) : isEdit ? (
              'Save changes'
            ) : (
              <>
                <Plus className="h-4 w-4" aria-hidden />
                Add product
              </>
            )}
          </button>
          <Link
            href="/products"
            className="inline-flex min-h-11 items-center rounded-lg border border-stone-300 bg-white px-4 text-sm font-medium text-stone-800 hover:bg-stone-50"
          >
            Cancel
          </Link>
          {isEdit && product ? (
            <ProductDeleteButton
              productId={product.id}
              transacted={Boolean(product.transacted)}
              afterDelete="list"
            />
          ) : null}
        </div>
      </section>
    </form>
  );
}
