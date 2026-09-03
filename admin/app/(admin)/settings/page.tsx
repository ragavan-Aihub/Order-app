export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Business settings</h1>
      <p className="text-stone-600">
        These fields will be loaded from Supabase and saved by administrators in a later phase.
      </p>
      <form className="max-w-xl space-y-4 rounded-xl border border-stone-200 bg-white p-6">
        <label className="block">
          <span className="mb-1 block font-medium">Business name</span>
          <input className="w-full rounded-lg border border-stone-300 px-3 py-2" disabled />
        </label>
        <label className="block">
          <span className="mb-1 block font-medium">Phone</span>
          <input className="w-full rounded-lg border border-stone-300 px-3 py-2" disabled />
        </label>
        <label className="block">
          <span className="mb-1 block font-medium">Email</span>
          <input className="w-full rounded-lg border border-stone-300 px-3 py-2" disabled />
        </label>
        <label className="block">
          <span className="mb-1 block font-medium">Address</span>
          <textarea className="w-full rounded-lg border border-stone-300 px-3 py-2" disabled />
        </label>
        <label className="block">
          <span className="mb-1 block font-medium">Description</span>
          <textarea className="w-full rounded-lg border border-stone-300 px-3 py-2" disabled />
        </label>
      </form>
    </div>
  );
}
