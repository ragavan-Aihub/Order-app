import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { redirect } from 'next/navigation';

import { CategoryForm } from '@/components/CategoryForm';
import { isCategoriesEnabled } from '@/services/business';

export default async function NewCategoryPage() {
  const enabled = await isCategoriesEnabled();
  if (!enabled) {
    redirect('/products/categories');
  }

  return (
    <div className="space-y-4">
      <h1 className="sr-only">Add category</h1>
      <Link
        href="/products/categories"
        className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Categories
      </Link>
      <CategoryForm />
    </div>
  );
}
