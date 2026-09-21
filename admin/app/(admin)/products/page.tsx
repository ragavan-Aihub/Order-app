import Link from 'next/link';

import { ProductImport } from '@/components/ProductImport';
import { ProductsBoard } from '@/components/ProductsBoard';
import { getAllProducts } from '@/services/products';

export default async function ProductsPage() {
  const products = await getAllProducts();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Products ({products.length})</h1>
          <p className="mt-1 text-stone-600">Items shown in the customer app</p>
        </div>
        <Link
          href="/products/new"
          className="inline-flex min-h-11 items-center rounded-lg bg-emerald-800 px-4 py-2 font-semibold text-white"
        >
          Add product
        </Link>
      </div>
      <ProductImport />
      {products.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white p-6 text-stone-600">
          No products yet. Add one, or import a filled template.
        </div>
      ) : (
        <ProductsBoard products={products} />
      )}
    </div>
  );
}
