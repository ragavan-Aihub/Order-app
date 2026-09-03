'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';

import { isSupabaseConfigured } from '@/config/env';
import { uploadProductImage } from '@/services/storage';
import { createBrowserSupabaseClient } from '@/services/supabase/browser';
import type { Product } from '@/types/product';

type ProductFormProps = {
  product?: Product;
};

export function ProductForm({ product }: ProductFormProps) {
  const router = useRouter();
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(product?.price?.toString() ?? '');
  const [available, setAvailable] = useState(product?.available ?? true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(product?.image_url ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function onImageSelected(file: File | null) {
    setImageFile(file);
    if (file) {
      setImagePreview(URL.createObjectURL(file));
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!isSupabaseConfigured) {
      setError('Connect Supabase to save products. Local mock data cannot be edited yet.');
      return;
    }

    if (!product && !imageFile) {
      setError('Add a product image.');
      return;
    }

    setSubmitting(true);
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setError('Supabase is not configured.');
      setSubmitting(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError('You are not signed in.');
      setSubmitting(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, business_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || profile.role !== 'admin' || !profile.business_id) {
      setError('This account cannot manage products.');
      setSubmitting(false);
      return;
    }

    let imageUrl = product?.image_url ?? null;
    if (imageFile) {
      try {
        imageUrl = await uploadProductImage(supabase, profile.business_id, imageFile);
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : 'Could not upload the image.');
        setSubmitting(false);
        return;
      }
    }

    const payload = {
      name: name.trim(),
      description: description.trim(),
      price: Number(price),
      available,
      business_id: profile.business_id,
      image_url: imageUrl,
    };

    const query = product
      ? supabase.from('products').update(payload).eq('id', product.id)
      : supabase.from('products').insert(payload);

    const { error: saveError } = await query;
    if (saveError) {
      setError('Could not save the product.');
      setSubmitting(false);
      return;
    }

    router.replace('/products');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-4">
      <div>
        <span className="mb-1 block font-medium">Product image</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={(event) => onImageSelected(event.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-stone-300 bg-white px-4 py-8 text-center hover:border-emerald-800 hover:bg-stone-50"
        >
          {imagePreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imagePreview}
              alt="Product preview"
              className="h-40 w-40 rounded-lg object-cover"
            />
          ) : (
            <p className="text-stone-600">No image selected</p>
          )}
          <span className="rounded-lg bg-emerald-800 px-5 py-2 font-semibold text-white">
            Browse
          </span>
          <p className="text-sm text-stone-500">
            {imageFile ? imageFile.name : 'Choose a photo from your computer. JPG, PNG, WebP, or GIF. Max 5 MB.'}
          </p>
        </button>
      </div>
      <label className="block">
        <span className="mb-1 block font-medium">Product name</span>
        <input
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-lg border border-stone-300 px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="mb-1 block font-medium">Description</span>
        <textarea
          required
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="w-full rounded-lg border border-stone-300 px-3 py-2"
          rows={4}
        />
      </label>
      <label className="block">
        <span className="mb-1 block font-medium">Price</span>
        <input
          required
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          className="w-full rounded-lg border border-stone-300 px-3 py-2"
        />
      </label>
      <fieldset className="space-y-2">
        <legend className="font-medium">Available</legend>
        <label className="mr-4">
          <input
            type="radio"
            name="available"
            checked={available}
            onChange={() => setAvailable(true)}
          />{' '}
          Yes
        </label>
        <label>
          <input
            type="radio"
            name="available"
            checked={!available}
            onChange={() => setAvailable(false)}
          />{' '}
          No
        </label>
      </fieldset>
      {error ? <p className="text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-emerald-800 px-4 py-3 font-semibold text-white disabled:opacity-60"
      >
        {submitting ? 'Saving…' : 'Save product'}
      </button>
    </form>
  );
}
