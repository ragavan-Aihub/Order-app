import { notFound } from 'next/navigation';

import { ProductForm } from '@/components/ProductForm';
import { getProductById } from '@/services/products';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Edit product</h1>
      <ProductForm product={product} />
    </div>
  );
}
