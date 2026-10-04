'use client';

import { ImagePlus, RefreshCw, Trash2, Upload, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';

import { Spinner, useActionNotice } from '@/components/ActionNotice';
import { saveCategory } from '@/services/category-actions';
import type { ProductCategory } from '@/types/category';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

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

export function CategoryForm({
  category,
}: {
  category?: Pick<ProductCategory, 'id' | 'name' | 'image_url'>;
}) {
  const router = useRouter();
  const notice = useActionNotice();
  const isEdit = Boolean(category?.id);
  const [name, setName] = useState(category?.name ?? '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(safePreviewSrc(category?.image_url ?? ''));
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
    const file = event.dataTransfer.files[0];
    if (file) {
      applyImage(file);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!isEdit && !imageFile) {
      setImageError('Add a category image.');
      return;
    }
    setSubmitting(true);
    const formData = new FormData();
    if (category?.id) {
      formData.set('id', category.id);
    }
    formData.set('name', name);
    if (imageRemoved && !imageFile) {
      formData.set('image_removed', '1');
    }
    if (imageFile) {
      formData.set('image', imageFile);
    }
    const result = await saveCategory(formData);
    if (result.error) {
      setSubmitting(false);
      setError(result.error);
      return;
    }
    notice.show(isEdit ? 'Category saved' : 'Category created');
    router.replace('/products/categories');
    router.refresh();
  }

  const hasPreview = Boolean(imagePreview);

  return (
    <form onSubmit={onSubmit} autoComplete="off" className="max-w-xl space-y-5">
      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="text-base font-semibold">
          Category image {isEdit ? null : <span className="text-red-500">*</span>}
        </h2>
        <p className="mt-1 text-sm text-stone-500">Shown on the Categories tab in the customer app. JPG, PNG, WebP, or GIF, up to 5 MB.</p>
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
        <div className={`mt-4 grid gap-5 ${hasPreview ? 'md:grid-cols-[minmax(0,1fr)_12rem]' : ''}`}>
          <div
            onDragEnter={onDragEnter}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`flex min-h-[10rem] flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center ${
              dragging ? 'border-emerald-500 bg-emerald-100/80' : 'border-emerald-200 bg-emerald-50/70'
            }`}
          >
            <Upload className="h-8 w-8 text-emerald-600" strokeWidth={1.75} aria-hidden />
            <p className="mt-3 text-sm font-medium text-stone-800">Drag and drop an image here</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-lg border border-emerald-600 bg-white px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              <ImagePlus className="h-4 w-4" aria-hidden />
              Choose image
            </button>
          </div>
          {hasPreview ? (
            <div className="min-w-0">
              <p className="mb-2 text-xs font-medium text-stone-500">Preview</p>
              <div className="relative overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="" className="aspect-square w-full object-cover" />
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

      <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">
            Category name <span className="text-red-500">*</span>
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            minLength={2}
            className="min-h-11 w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </label>
        {error ? <p className="text-red-700">{error}</p> : null}
        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {submitting ? <Spinner /> : null}
          {submitting ? 'Saving…' : isEdit ? 'Save category' : 'Create category'}
        </button>
      </section>
    </form>
  );
}
