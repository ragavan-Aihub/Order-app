import Link from 'next/link';

import { CategoriesBoard } from '@/components/CategoriesBoard';
import { CategoriesEnablePanel } from '@/components/CategoriesEnablePanel';
import { CategoryForm } from '@/components/CategoryForm';
import { isCategoriesEnabled } from '@/services/business';
import { getCategories } from '@/services/categories';

export const dynamic = 'force-dynamic';

export default async function ProductCategoriesPage() {
  const enabled = await isCategoriesEnabled();
  const categories = enabled ? await getCategories() : [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/products" className="text-sm font-medium text-emerald-700">
          ← Products
        </Link>
        <h1 className="mt-2 text-2xl font-bold md:text-3xl">
          {enabled ? `Categories (${categories.length})` : 'Categories'}
        </h1>
        <p className="mt-1 text-stone-600">Optional grouping for products. Items can stay uncategorized.</p>
      </div>
      <CategoriesEnablePanel enabled={enabled} />
      {enabled ? (
        <>
          <CategoryForm />
          {categories.length === 0 ? (
            <div className="rounded-xl border border-stone-200 bg-white p-6 text-stone-600">
              No categories yet. Create one above, then assign it when you add or edit a product.
            </div>
          ) : (
            <CategoriesBoard categories={categories} />
          )}
        </>
      ) : null}
    </div>
  );
}
