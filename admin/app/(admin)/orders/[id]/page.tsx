export default async function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Order details</h1>
      <p className="text-stone-600">Order ID: {id}</p>
      <p className="text-stone-600">Orders will load from Supabase in a later phase.</p>
    </div>
  );
}
