import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { ProductForm } from '@/components/ProductForm';
import { isCategoriesEnabled } from '@/services/business';
import { getCategories } from '@/services/categories';

export default async function AddProductPage() {
  const enabled = await isCategoriesEnabled();
  const categories = enabled ? await getCategories() : [];

  return (
    <div className="space-y-4">
      <h1 className="sr-only">Add product</h1>
      <Link
        href="/products"
        className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Products
      </Link>
      <ProductForm
        categoriesEnabled={enabled}
        categories={categories.filter((item) => item.active).map((item) => ({ id: item.id, name: item.name }))}
      />
    </div>
  );
}
