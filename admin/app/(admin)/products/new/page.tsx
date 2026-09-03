import { ProductForm } from '@/components/ProductForm';

export default function AddProductPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Add product</h1>
      <ProductForm />
    </div>
  );
}
