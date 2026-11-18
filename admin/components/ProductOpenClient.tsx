'use client';

import { useEffect, useMemo, useState } from 'react';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.farm2flavour.app';
const APP_SCHEME = 'farm2flavour';

type Props = {
  productId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
};

function detectPlatform(ua: string): 'android' | 'ios' | 'other' {
  const lower = ua.toLowerCase();
  if (/iphone|ipad|ipod/.test(lower)) {
    return 'ios';
  }
  if (/android/.test(lower)) {
    return 'android';
  }
  return 'other';
}

function androidIntentUrl(productId: string) {
  const fallback = encodeURIComponent(PLAY_STORE_URL);
  return `intent://product/${productId}#Intent;scheme=${APP_SCHEME};package=com.farm2flavour.app;S.browser_fallback_url=${fallback};end`;
}

export function ProductOpenClient({ productId, name, description, imageUrl }: Props) {
  const [platform, setPlatform] = useState<'android' | 'ios' | 'other' | null>(null);

  useEffect(() => {
    const next = detectPlatform(navigator.userAgent || '');
    setPlatform(next);
    if (next !== 'android') {
      return;
    }
    // Intent URL opens the app when installed; otherwise Play Store fallback.
    window.location.replace(androidIntentUrl(productId));
  }, [productId]);

  const blurb = useMemo(() => {
    const text = description?.trim();
    if (!text) {
      return 'Open this item in the Farm2Flavours app.';
    }
    return text.length > 140 ? `${text.slice(0, 137)}…` : text;
  }, [description]);

  if (platform === null) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-10">
        <p className="text-center text-sm text-stone-500">Opening…</p>
      </main>
    );
  }

  if (platform === 'android') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-5 py-10">
        <ProductPreview name={name} blurb={blurb} imageUrl={imageUrl} />
        <p className="text-center text-sm text-stone-600">Opening Farm2Flavours…</p>
        <a
          href={androidIntentUrl(productId)}
          className="rounded-xl bg-teal-800 px-4 py-3 text-center text-base font-bold text-white"
        >
          Open in app
        </a>
        <a
          href={PLAY_STORE_URL}
          className="rounded-xl border border-stone-300 bg-white px-4 py-3 text-center text-base font-semibold text-teal-900"
        >
          Get it on Google Play
        </a>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-5 py-10">
      <ProductPreview name={name} blurb={blurb} imageUrl={imageUrl} />
      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-teal-800">iPhone / iPad</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-stone-900">Coming soon</h1>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          Farm2Flavours for iOS is on the way. Open this link again once the iPhone app is available.
        </p>
      </div>
    </main>
  );
}

function ProductPreview({
  name,
  blurb,
  imageUrl,
}: {
  name: string;
  blurb: string;
  imageUrl: string | null;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-stone-100 p-3">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="h-16 w-16 rounded-xl object-cover bg-stone-200" />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-teal-50 text-xs font-bold text-teal-800">
          F2F
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-extrabold text-stone-900">{name}</p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-stone-500">{blurb}</p>
      </div>
    </div>
  );
}
