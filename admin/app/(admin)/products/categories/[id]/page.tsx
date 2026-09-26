import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';

import { CategoryForm } from '@/components/CategoryForm';
import { isCategoriesEnabled } from '@/services/business';
import { getCategoryById } from '@/services/categories';

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const enabled = await isCategoriesEnabled();
  if (!enabled) {
    redirect('/products/categories');
  }

  const { id } = await params;
  const category = await getCategoryById(id);
  if (!category) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <h1 className="sr-only">Edit {category.name}</h1>
      <Link
        href="/products/categories"
        className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Categories
      </Link>
      <CategoryForm category={category} />
    </div>
  );
}
