'use client';

import { useState, type FormEvent } from 'react';

import { isSupabaseConfigured } from '@/config/env';
import { createBrowserSupabaseClient } from '@/services/supabase/browser';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isSupabaseConfigured) {
    return (
      <p className="text-stone-600">
        Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to
        enable admin login. Until then, the local dashboard stays open for development.
      </p>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setError('Supabase is not configured.');
      setSubmitting(false);
      return;
    }

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError || !data.user) {
      setError(signInError?.message ?? 'Could not sign in. Check the email and password.');
      setSubmitting(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, business_id')
      .eq('id', data.user.id)
      .maybeSingle();

    if (!profile || profile.role !== 'admin' || !profile.business_id) {
      await supabase.auth.signOut();
      setError('This account is not authorized for the admin panel.');
      setSubmitting(false);
      return;
    }

    window.location.assign('/');
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-1 block font-medium">Email</span>
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border border-[#c9d6b8] px-3 py-2.5 text-base outline-none focus:border-[#1B4D2E] focus:ring-2 focus:ring-[#1B4D2E]/20"
        />
      </label>
      <label className="block">
        <span className="mb-1 block font-medium">Password</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border border-[#c9d6b8] px-3 py-2.5 text-base outline-none focus:border-[#1B4D2E] focus:ring-2 focus:ring-[#1B4D2E]/20"
        />
      </label>
      {error ? <p className="text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-[#1B4D2E] px-4 py-3 text-base font-semibold text-white hover:bg-[#163f26] disabled:opacity-60"
      >
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
