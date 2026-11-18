import Link from 'next/link';
import { Suspense } from 'react';

import { PageSkeleton } from '@/components/PageSkeleton';
import { ProductImport } from '@/components/ProductImport';
import { isCategoriesEnabled } from '@/services/business';
import { getActiveCategories } from '@/services/categories';
import { getAllProducts } from '@/services/products';

export const dynamic = 'force-dynamic';

async function ImportBody() {
  const enabled = await isCategoriesEnabled();
  const [products, categories] = await Promise.all([
    getAllProducts({ includeTransacted: false }),
    enabled ? getActiveCategories() : Promise.resolve([]),
  ]);

  return (
    <>
      <p className="mt-1 text-stone-600">
        Download the template or a full Excel-ready export of all {products.length} products, then import a filled CSV.
      </p>
      <div className="mt-6">
        <ProductImport
          categoriesEnabled={enabled}
          categoryNames={categories.map((item) => item.name)}
          products={products}
        />
      </div>
    </>
  );
}

export default function ProductImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/products" className="text-sm font-medium text-emerald-700">
          ← Products
        </Link>
        <h1 className="mt-2 text-2xl font-bold md:text-3xl">Import products</h1>
        <Suspense fallback={<PageSkeleton label="Loading catalog…" />}>
          <ImportBody />
        </Suspense>
      </div>
    </div>
  );
}
