import Link from 'next/link';

export default function ProductOpenNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 bg-[#f7f4ef] px-5 py-10 text-stone-900">
      <h1 className="text-2xl font-extrabold">Product not found</h1>
      <p className="text-sm leading-6 text-stone-600">
        This share link is invalid or the product is no longer available.
      </p>
      <a
        href="https://play.google.com/store/apps/details?id=com.farm2flavour.app"
        className="rounded-xl bg-teal-800 px-4 py-3 text-center text-base font-bold text-white"
      >
        Get Farm2Flavour on Google Play
      </a>
      <Link href="/login" className="text-center text-sm font-semibold text-teal-900 underline">
        Admin sign in
      </Link>
    </main>
  );
}
