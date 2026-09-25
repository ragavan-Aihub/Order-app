import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';

import { ProductForm } from '@/components/ProductForm';
import { isCategoriesEnabled } from '@/services/business';
import { getCategories } from '@/services/categories';
import { getProductById } from '@/services/products';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    notFound();
  }

  const enabled = await isCategoriesEnabled();
  const allCategories = enabled ? await getCategories() : [];
  const options = allCategories
    .filter((item) => item.active || item.id === product.category_id)
    .map((item) => ({ id: item.id, name: item.name }));

  return (
    <div className="space-y-4">
      <h1 className="sr-only">Edit product</h1>
      <Link
        href="/products"
        className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Products
      </Link>
      <ProductForm product={product} categoriesEnabled={enabled} categories={options} />
    </div>
  );
}
