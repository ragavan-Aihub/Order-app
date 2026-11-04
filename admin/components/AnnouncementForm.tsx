'use client';

import { ChevronDown, ChevronUp, ImagePlus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState, type DragEvent, type FormEvent } from 'react';

import { Spinner, useActionNotice } from '@/components/ActionNotice';
import { ChoiceSwitch } from '@/components/ChoiceSwitch';
import { PosterCrop } from '@/components/PosterCrop';
import { isSupabaseConfigured } from '@/config/env';
import { cropBannerFile } from '@/lib/crop-banner';
import { saveShopBanners } from '@/services/business-actions';
import { uploadBusinessAnnouncement } from '@/services/storage';
import { createBrowserSupabaseClient } from '@/services/supabase/browser';
import type { Business } from '@/types/business';

const MAX_POSTERS = 8;

type PosterDraft = {
  key: string;
  preview: string;
  file: File | null;
  panX: number;
  panY: number;
  zoom: number;
  dirty: boolean;
  notify: boolean;
};

export function AnnouncementForm({
  business,
  banners,
}: {
  business: Business;
  banners: { image_url: string; focus_y?: number }[];
}) {
  const router = useRouter();
  const notice = useActionNotice();
  const fileRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(business.announcement_active);
  const [posters, setPosters] = useState<PosterDraft[]>(() =>
    (banners.length > 0
      ? banners
      : business.announcement_image_url
        ? [{ image_url: business.announcement_image_url }]
        : []
    ).map((banner) => ({
      key: crypto.randomUUID(),
      preview: banner.image_url,
      file: null,
      panX: 0.5,
      panY: (banner.focus_y ?? 50) / 100,
      zoom: 1,
      dirty: false,
      notify: false,
    })),
  );
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function addFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }
    setPosters((current) => {
      const room = MAX_POSTERS - current.length;
      if (room <= 0) {
        return current;
      }
      const next = files.slice(0, room).map((file) => ({
        key: crypto.randomUUID(),
        preview: URL.createObjectURL(file),
        file,
        panX: 0.5,
        panY: 0.5,
        zoom: 1,
        dirty: true,
        notify: false,
      }));
      return [...current, ...next];
    });
  }

  function move(index: number, direction: -1 | 1) {
    setPosters((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) {
        return current;
      }
      const copy = current.slice();
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragging(false);
    addFiles(Array.from(event.dataTransfer.files ?? []));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!isSupabaseConfigured) {
      setError('Connect Supabase to save these posters.');
      return;
    }
    if (active && posters.length === 0) {
      setError('Add a poster before showing announcements.');
      return;
    }

    setSubmitting(true);
    const mustCrop = posters.some((poster) => poster.file || poster.dirty);
    const supabase = mustCrop ? createBrowserSupabaseClient() : null;
    if (mustCrop && !supabase) {
      setError('Supabase is not configured.');
      setSubmitting(false);
      return;
    }

    const savedPosters: { imageUrl: string; focusY: number; notify: boolean }[] = [];
    try {
      for (const poster of posters) {
        if (poster.file || poster.dirty) {
          const cropped = await cropBannerFile(poster.preview, poster.panX, poster.panY, poster.zoom);
          savedPosters.push({
            imageUrl: await uploadBusinessAnnouncement(supabase!, business.id, cropped),
            focusY: 50,
            notify: poster.notify,
          });
        } else if (poster.preview.startsWith('https://')) {
          savedPosters.push({
            imageUrl: poster.preview,
            focusY: Math.round(poster.panY * 100),
            notify: poster.notify,
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload a poster.');
      setSubmitting(false);
      return;
    }

    const result = await saveShopBanners({
      businessId: business.id,
      posters: savedPosters,
      active,
    });
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setPosters(
      savedPosters.map((poster) => ({
        key: crypto.randomUUID(),
        preview: poster.imageUrl,
        file: null,
        panX: 0.5,
        panY: poster.focusY / 100,
        zoom: 1,
        dirty: false,
        notify: false,
      })),
    );
    notice.show(result.pushNote ?? (active ? 'Posters are on the home screen' : 'Announcements hidden'));
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-4">
        <ChoiceSwitch
          checked={active}
          onCheckedChange={setActive}
          title={active ? 'Showing on the home screen' : 'Hidden from customers'}
          description={
            active
              ? 'Customers see this small banner under the categories.'
              : 'Save the posters now. Turn this on when they should appear in the app.'
          }
        />

        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-base font-semibold">Posters</p>
          <p className="mt-1 text-sm leading-6 text-stone-600">
            Choose a photo, then drag it inside the frame. Use − and + to see more of it or crop closer. The phone
            preview on the right is the banner customers see under the categories.
            Add up to {MAX_POSTERS}.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={(event) => {
              addFiles(Array.from(event.target.files ?? []));
              event.target.value = '';
            }}
          />
          <div className="mt-4 space-y-3">
            {posters.map((poster, index) => (
              <div key={poster.key} className="rounded-2xl border border-stone-200 bg-white p-3">
                <p className="mb-2 text-sm font-semibold text-stone-700">Crop the banner</p>
                <PosterCrop
                  src={poster.preview}
                  panX={poster.panX}
                  panY={poster.panY}
                  zoom={poster.zoom}
                  onChange={(crop) =>
                    setPosters((current) =>
                      current.map((item) => (item.key === poster.key ? { ...item, ...crop, dirty: true } : item)),
                    )
                  }
                />
                <div className="mt-3">
                  <ChoiceSwitch
                    checked={poster.notify}
                    onCheckedChange={(notify) =>
                      setPosters((current) =>
                        current.map((item) => (item.key === poster.key ? { ...item, notify } : item)),
                      )
                    }
                    title={poster.notify ? 'Phone alert on' : 'No phone alert'}
                    description={
                      poster.notify
                        ? 'Customers who allowed notifications get this poster when you publish.'
                        : 'This poster updates the home screen only.'
                    }
                  />
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 border-t border-stone-200 pt-2">
                  <span className="text-sm font-semibold text-stone-600">
                    {index + 1} of {posters.length}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      aria-label="Move poster earlier"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-stone-100 disabled:opacity-30"
                    >
                      <ChevronUp size={20} aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label="Move poster later"
                      disabled={index === posters.length - 1}
                      onClick={() => move(index, 1)}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-stone-100 disabled:opacity-30"
                    >
                      <ChevronDown size={20} aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label="Remove poster"
                      onClick={() => setPosters((current) => current.filter((item) => item.key !== poster.key))}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-red-700 hover:bg-red-50"
                    >
                      <Trash2 size={18} aria-hidden />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {posters.length < MAX_POSTERS ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`mt-4 flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-6 ${
                dragging ? 'border-emerald-500 bg-emerald-50' : 'border-stone-300 hover:border-stone-400'
              }`}
            >
              <ImagePlus size={26} strokeWidth={1.75} aria-hidden />
              <span className="text-base font-semibold">Add poster</span>
              <span className="text-sm text-stone-600">Tap to choose one or more, or drop images here</span>
            </button>
          ) : (
            <p className="mt-4 text-sm text-stone-600">8 posters is the maximum. Remove one to add another.</p>
          )}
        </div>

        {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 sm:w-auto"
        >
          {submitting ? <Spinner /> : null}
          {submitting ? 'Saving…' : active ? 'Publish' : 'Save draft'}
        </button>
      </div>

      {posters.length > 0 ? (
        <aside className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5 xl:sticky xl:top-6">
          <p className="text-xs font-semibold tracking-wide text-stone-500">HOME SCREEN</p>
          <p className="mt-1 text-sm text-stone-600">
            {active
              ? 'Customers see this banner under the categories.'
              : 'Hidden until you turn posters on.'}
          </p>
          <div className={`mx-auto mt-4 w-full max-w-sm ${active ? '' : 'opacity-60'}`}>
            <PosterCrop
              src={posters[0].preview}
              panX={posters[0].panX}
              panY={posters[0].panY}
              zoom={posters[0].zoom}
            />
          </div>
          {posters.length > 1 ? (
            <p className="mt-3 text-center text-sm font-medium text-stone-600">{posters.length} posters</p>
          ) : null}
        </aside>
      ) : null}
    </form>
  );
}
