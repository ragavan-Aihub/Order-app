'use client';

import { useRef, useState, type FormEvent } from 'react';

import { isSupabaseConfigured } from '@/config/env';
import { uploadBusinessBanner, uploadBusinessLogo } from '@/services/storage';
import { createBrowserSupabaseClient } from '@/services/supabase/browser';
import type { Business } from '@/types/business';

export function BrandingForm({ business }: { business: Business }) {
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState(business.logo_url ?? '');
  const [bannerPreview, setBannerPreview] = useState(business.banner_url ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState<'logo' | 'banner' | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  function onLogoSelected(file: File | null) {
    setLogoFile(file);
    setSaved(false);
    if (file) {
      setLogoPreview(URL.createObjectURL(file));
    }
  }

  function onBannerSelected(file: File | null) {
    setBannerFile(file);
    setSaved(false);
    if (file) {
      setBannerPreview(URL.createObjectURL(file));
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    if (!isSupabaseConfigured) {
      setError('Connect Supabase to save branding.');
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
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
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

    if (!profile || profile.role !== 'admin' || profile.business_id !== business.id) {
      setError('This account cannot change this business.');
      setSubmitting(false);
      return;
    }

    let logoUrl = business.logo_url;
    let bannerUrl = business.banner_url;

    try {
      if (logoFile) {
        setUploading('logo');
        logoUrl = await uploadBusinessLogo(supabase, profile.business_id, logoFile);
      }
      if (bannerFile) {
        setUploading('banner');
        bannerUrl = await uploadBusinessBanner(supabase, profile.business_id, bannerFile);
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not upload the image.');
      setUploading(null);
      setSubmitting(false);
      return;
    }

    setUploading(null);

    const { error: saveError } = await supabase
      .from('businesses')
      .update({
        logo_url: logoUrl,
        banner_url: bannerUrl,
      })
      .eq('id', profile.business_id);

    if (saveError) {
      setError(saveError.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setSaved(true);
    setLogoFile(null);
    setBannerFile(null);
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-8 rounded-xl border border-stone-200 bg-white p-6">
      <h2 className="text-xl font-semibold">Branding</h2>

      <section className="space-y-3">
        <h3 className="font-medium">Business logo</h3>
        <input
          ref={logoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={(event) => onLogoSelected(event.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => logoInputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-stone-300 px-4 py-8 text-center hover:border-emerald-800 hover:bg-stone-50"
        >
          {logoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoPreview} alt="Business logo preview" className="h-28 w-28 rounded-full object-cover" />
          ) : (
            <p className="text-stone-600">No logo yet</p>
          )}
          <span className="rounded-lg bg-emerald-800 px-5 py-2 font-semibold text-white">
            {logoPreview ? 'Replace logo' : 'Upload logo'}
          </span>
          <p className="text-sm text-stone-500">JPG, PNG, WebP, or GIF. Max 5 MB.</p>
        </button>
        {uploading === 'logo' ? <p className="text-sm text-stone-600">Uploading logo…</p> : null}
      </section>

      <section className="space-y-3">
        <h3 className="font-medium">Home banner</h3>
        <input
          ref={bannerInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={(event) => onBannerSelected(event.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => bannerInputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-stone-300 px-4 py-8 text-center hover:border-emerald-800 hover:bg-stone-50"
        >
          {bannerPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bannerPreview}
              alt="Home banner preview"
              className="max-h-48 w-full rounded-lg object-cover"
            />
          ) : (
            <p className="text-stone-600">No banner yet</p>
          )}
          <span className="rounded-lg bg-emerald-800 px-5 py-2 font-semibold text-white">
            {bannerPreview ? 'Replace banner' : 'Upload banner'}
          </span>
          <p className="text-sm text-stone-500">Promotional image for the customer home screen. Max 5 MB.</p>
        </button>
        {uploading === 'banner' ? <p className="text-sm text-stone-600">Uploading banner…</p> : null}
      </section>

      {error ? <p className="text-red-700">{error}</p> : null}
      {saved ? <p className="text-emerald-800">Branding saved.</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-emerald-800 px-4 py-3 font-semibold text-white disabled:opacity-60"
      >
        {submitting ? 'Saving…' : 'Save branding'}
      </button>
    </form>
  );
}
