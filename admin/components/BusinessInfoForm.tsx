'use client';

import { useState, type FormEvent } from 'react';

import { isSupabaseConfigured } from '@/config/env';
import { createBrowserSupabaseClient } from '@/services/supabase/browser';
import type { Business } from '@/types/business';

export function BusinessInfoForm({ business }: { business: Business }) {
  const [name, setName] = useState(business.business_name);
  const [phone, setPhone] = useState(business.phone ?? '');
  const [email, setEmail] = useState(business.email ?? '');
  const [address, setAddress] = useState(business.address ?? '');
  const [description, setDescription] = useState(business.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function markDirty() {
    setSaved(false);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);

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

    const { error: saveError } = await supabase
      .from('businesses')
      .update({
        business_name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        address: address.trim() || null,
        description: description.trim() || null,
      })
      .eq('id', profile.business_id);

    if (saveError) {
      setError(saveError.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setSaved(true);
  }

  const fieldClass = 'w-full rounded-lg border border-stone-300 px-3 py-2';

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-4 rounded-xl border border-stone-200 bg-white p-6">
      <h2 className="text-xl font-semibold">Business info</h2>
      <label className="block">
        <span className="mb-1 block font-medium">
          Business name <span className="text-red-700">*</span>
        </span>
        <input
          required
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            markDirty();
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
            markDirty();
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
            markDirty();
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
            markDirty();
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
            markDirty();
          }}
          className={fieldClass}
          rows={4}
        />
      </label>
      {error ? <p className="text-red-700">{error}</p> : null}
      {saved ? <p className="text-emerald-800">Business info saved.</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-emerald-800 px-4 py-3 font-semibold text-white disabled:opacity-60"
      >
        {submitting ? 'Saving…' : 'Save business info'}
      </button>
    </form>
  );
}
