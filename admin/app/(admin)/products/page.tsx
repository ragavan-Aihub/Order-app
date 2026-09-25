import Link from 'next/link';

import { ProductImport } from '@/components/ProductImport';
import { ProductsBoard } from '@/components/ProductsBoard';
import { isCategoriesEnabled } from '@/services/business';
import { getActiveCategories } from '@/services/categories';
import { getAllProducts } from '@/services/products';

export default async function ProductsPage() {
  const enabled = await isCategoriesEnabled();
  const [products, categories] = await Promise.all([
    getAllProducts(),
    enabled ? getActiveCategories() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Products ({products.length})</h1>
          <p className="mt-1 text-stone-600">Items shown in the customer app</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/products/categories"
            className="inline-flex min-h-11 items-center rounded-lg border border-stone-300 bg-white px-4 py-2 font-semibold text-stone-800 hover:bg-stone-50"
          >
            Categories
          </Link>
          <Link
            href="/products/new"
            className="inline-flex min-h-11 items-center rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 font-semibold text-white"
          >
            Add product
          </Link>
        </div>
      </div>
      <ProductImport
        categoriesEnabled={enabled}
        categoryNames={categories.map((item) => item.name)}
      />
      {products.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white p-6 text-stone-600">
          No products yet. Add one, or import a filled template.
        </div>
      ) : (
        <ProductsBoard products={products} categoriesEnabled={enabled} categories={categories} />
      )}
    </div>
  );
}
