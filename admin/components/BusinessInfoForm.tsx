'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';

import { Spinner, useActionNotice } from '@/components/ActionNotice';
import { isSupabaseConfigured } from '@/config/env';
import { updateBusinessBranding, updateBusinessInfo } from '@/services/business-actions';
import { uploadBusinessLogo } from '@/services/storage';
import { createBrowserSupabaseClient } from '@/services/supabase/browser';
import type { Business } from '@/types/business';

export function BusinessInfoForm({ business }: { business: Business }) {
  const router = useRouter();
  const notice = useActionNotice();
  const [name, setName] = useState(business.business_name);
  const [phone, setPhone] = useState(business.phone ?? '');
  const [email, setEmail] = useState(business.email ?? '');
  const [address, setAddress] = useState(business.address ?? '');
  const [description, setDescription] = useState(business.description ?? '');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState(business.logo_url ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!isSupabaseConfigured) {
      setError('Connect Supabase to save business info.');
      return;
    }

    if (!name.trim()) {
      setError('Business name is required.');
      return;
    }
    if (!phone.trim()) {
      setError('Phone is required.');
      return;
    }

    setSubmitting(true);
    const infoResult = await updateBusinessInfo({
      businessId: business.id,
      name,
      phone,
      email,
      address,
      description,
    });
    if (infoResult.error) {
      setError(infoResult.error);
      setSubmitting(false);
      return;
    }

    if (logoFile) {
      const supabase = createBrowserSupabaseClient();
      if (!supabase) {
        setError('Supabase is not configured.');
        setSubmitting(false);
        return;
      }
      try {
        const logoUrl = await uploadBusinessLogo(supabase, business.id, logoFile);
        const logoResult = await updateBusinessBranding({
          businessId: business.id,
          logoUrl,
          bannerUrl: business.banner_url,
        });
        if (logoResult.error) {
          setError(logoResult.error);
          setSubmitting(false);
          return;
        }
        setLogoFile(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not upload the logo.');
        setSubmitting(false);
        return;
      }
    }

    notice.show('Saved successfully');
    router.push('/');
  }

  const fieldClass = 'w-full rounded-lg border border-stone-300 px-3 py-2';

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-4 rounded-xl border border-stone-200 bg-white p-4 sm:p-6">
      <h2 className="text-xl font-semibold">Shop profile</h2>
      <p className="text-sm text-stone-600">Saved on the business record and printed on the delivery bill.</p>
      <div>
        <span className="mb-1 block font-medium">Logo</span>
        <div className="flex items-center gap-4">
          {logoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoPreview} alt="" className="h-20 w-20 rounded-full border border-stone-200 object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-stone-300 text-xs text-stone-500">
              No logo
            </div>
          )}
          <div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setLogoFile(file);
                if (file) {
                  setLogoPreview(URL.createObjectURL(file));
                }
              }}
            />
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium"
            >
              Choose logo
            </button>
          </div>
        </div>
      </div>
      <label className="block">
        <span className="mb-1 block font-medium">
          Business name <span className="text-red-700">*</span>
        </span>
        <input
          required
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          className={fieldClass}
        />
      </label>
      <label className="block">
        <span className="mb-1 block font-medium">
          Phone <span className="text-red-700">*</span>
        </span>
        <input
          required
          value={phone}
          onChange={(event) => {
            setPhone(event.target.value);
          }}
          className={fieldClass}
        />
      </label>
      <label className="block">
        <span className="mb-1 block font-medium">Email</span>
        <input
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
          className={fieldClass}
        />
      </label>
      <label className="block">
        <span className="mb-1 block font-medium">Address</span>
        <textarea
          value={address}
          onChange={(event) => {
            setAddress(event.target.value);
          }}
          className={fieldClass}
          rows={3}
        />
      </label>
      <label className="block">
        <span className="mb-1 block font-medium">Description</span>
        <textarea
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
          }}
          className={fieldClass}
          rows={4}
        />
      </label>
      {error ? <p className="text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-3 font-semibold text-white disabled:opacity-60 sm:w-auto"
      >
        {submitting ? <Spinner /> : null}
        {submitting ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
