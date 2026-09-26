'use client';

import {
  ImagePlus,
  Info,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';

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
  const isEdit = Boolean(product);
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(product?.price != null ? product.price.toFixed(2) : '');
  const [categoryId, setCategoryId] = useState(product?.category_id ?? '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(safePreviewSrc(product?.image_url ?? ''));
  const [imageRemoved, setImageRemoved] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setImageError(null);

    if (!product && !imageFile) {
      setImageError('Add a product image.');
      return;
    }

    const priceValue = Number(price);
    if (!Number.isFinite(priceValue) || priceValue < 0 || priceValue > PRICE_MAX) {
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
    formData.set('price', price);
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

    router.replace('/products');
    router.refresh();
  }

  const hasPreview = Boolean(imagePreview);

  return (
    <form onSubmit={onSubmit} autoComplete="off" className="max-w-3xl space-y-5">
      <section className="rounded-2xl border border-stone-200 bg-white p-5 md:p-6">
        <h2 className="text-base font-semibold">
          Product image {isEdit ? null : <span className="text-red-500">*</span>}
        </h2>
        <p className="mt-1 text-sm text-stone-500">Shown in the customer app. JPG, PNG, WebP, or GIF, up to 5 MB.</p>

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
            onDragEnter={onDragEnter}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`flex min-h-[11.5rem] flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
              dragging
                ? 'border-emerald-500 bg-emerald-100/80'
                : 'border-emerald-200 bg-emerald-50/70'
            }`}
          >
            <Upload className="h-8 w-8 text-emerald-600" strokeWidth={1.75} aria-hidden />
            <p className="mt-3 text-sm font-medium text-stone-800">Drag and drop an image here</p>
            <p className="mt-1 text-xs text-stone-400">or</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-lg border border-emerald-600 bg-white px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              <ImagePlus className="h-4 w-4" aria-hidden />
              Choose image
            </button>
            <p className="mt-3 text-xs text-stone-400">JPG, PNG, WebP, or GIF · Max 5 MB</p>
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
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-700 hover:bg-stone-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Replace
                </button>
                <button
                  type="button"
                  onClick={clearImage}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Remove
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

        <div className={`grid gap-4 ${categoriesEnabled ? 'sm:grid-cols-2' : 'sm:max-w-sm'}`}>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">
              Price (₹) <span className="text-red-500">*</span>
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
        </div>

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
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-emerald-700 px-4 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {submitting ? (
              'Saving…'
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
