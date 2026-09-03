import Link from 'next/link';

import { getAllProducts } from '@/services/products';
import { formatPrice } from '@/utils/format';

export default async function ProductsPage() {
  const products = await getAllProducts();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Products</h1>
        <Link href="/products/new" className="rounded-lg bg-emerald-800 px-4 py-2 font-semibold text-white">
          Add product
        </Link>
      </div>
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-left text-base">
          <thead className="bg-stone-50 text-stone-600">
            <tr>
              <th className="px-4 py-3 font-medium">Image</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Available</th>
              <th className="px-4 py-3 font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-t border-stone-200">
                <td className="px-4 py-3">
                  {product.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="h-14 w-14 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-lg bg-stone-100" />
                  )}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{product.name}</p>
                  <p className="text-sm text-stone-500">{product.description}</p>
                </td>
                <td className="px-4 py-3">{formatPrice(product.price)}</td>
                <td className="px-4 py-3">{product.available ? 'Yes' : 'No'}</td>
                <td className="px-4 py-3">
                  <Link href={`/products/${product.id}`} className="font-medium text-emerald-800">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
