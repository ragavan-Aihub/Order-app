import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F4EF] p-6">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8">
        <h1 className="mb-2 text-3xl font-bold">Not authorized</h1>
        <p className="text-stone-600">
          This account cannot access the admin panel. Customer accounts must use the mobile app.
          Sign in with an admin account for this business.
        </p>
        <Link href="/login" className="mt-6 inline-block font-semibold text-emerald-800">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
