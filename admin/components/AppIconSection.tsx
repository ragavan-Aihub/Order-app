'use client';

import { useState } from 'react';

import { PosterCrop } from '@/components/PosterCrop';
import { cropAppIcons, downloadFile } from '@/lib/crop-app-icon';
import { updateBusinessAppIcons } from '@/services/business-actions';
import { uploadBusinessAppIcon, uploadBusinessNotificationIcon } from '@/services/storage';
import { createBrowserSupabaseClient } from '@/services/supabase/browser';

export function AppIconSection({
  businessId,
  logoSrc,
  appIconUrl,
  notificationIconUrl,
}: {
  businessId: string;
  logoSrc: string;
  appIconUrl: string | null;
  notificationIconUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [panX, setPanX] = useState(0.5);
  const [panY, setPanY] = useState(0.5);
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedColour, setSavedColour] = useState(appIconUrl);
  const [savedGlyph, setSavedGlyph] = useState(notificationIconUrl);

  async function makeFiles() {
    return cropAppIcons(logoSrc, panX, panY, zoom);
  }

  async function onDownload() {
    setError(null);
    setBusy(true);
    try {
      const files = await makeFiles();
      downloadFile(files.colour);
      downloadFile(files.notification);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not make the icons.');
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    setError(null);
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setError('Connect Supabase to save these icons.');
      return;
    }
    setBusy(true);
    try {
      const files = await makeFiles();
      const colourUrl = await uploadBusinessAppIcon(supabase, businessId, files.colour);
      const glyphUrl = await uploadBusinessNotificationIcon(supabase, businessId, files.notification);
      const result = await updateBusinessAppIcons({
        businessId,
        appIconUrl: colourUrl,
        notificationIconUrl: glyphUrl,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSavedColour(colourUrl);
      setSavedGlyph(glyphUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the icons.');
    } finally {
      setBusy(false);
    }
  }

  if (!logoSrc) {
    return (
      <div>
        <span className="mb-1 block font-medium">App icon</span>
        <p className="text-sm text-stone-600">Add a shop logo first, then you can crop an app icon from it.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <span className="mb-1 block font-medium">App icon</span>
      <p className="text-sm text-stone-600">
        Crop a square from the shop logo. Download the colour file for the home-screen icon and the white file for
        phone alerts. These files go into the next customer app build. Saving them here does not change the icon on
        phones until that build is installed.
      </p>
      {savedColour ? (
        <div className="flex flex-wrap items-end gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={savedColour} alt="" className="h-16 w-16 rounded-2xl border border-stone-200 object-cover" />
          {savedGlyph ? (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-800 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={savedGlyph} alt="" className="h-10 w-10 object-contain" />
            </div>
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="min-h-11 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium"
      >
        {open ? 'Hide crop' : savedColour ? 'Edit app icon' : 'Create app icon'}
      </button>
      {open ? (
        <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-3">
          <PosterCrop
            square
            src={logoSrc}
            panX={panX}
            panY={panY}
            zoom={zoom}
            onChange={(next) => {
              setPanX(next.panX);
              setPanY(next.panY);
              setZoom(next.zoom);
            }}
          />
          <p className="text-xs text-stone-500">Left: colour home-screen icon. Right: white alert icon on a dark tile.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void onDownload()}
              className="min-h-11 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium disabled:opacity-60"
            >
              {busy ? 'Working…' : 'Download PNG files'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onSave()}
              className="min-h-11 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Save for this shop'}
            </button>
          </div>
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
