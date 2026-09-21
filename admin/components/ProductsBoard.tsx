'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { AvailabilityToggle } from '@/components/AvailabilityToggle';
import { TableScroll } from '@/components/TableScroll';
import type { Product } from '@/types/product';
import { formatPrice } from '@/utils/format';

export function ProductsBoard({ products }: { products: Product[] }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return products;
    }
    return products.filter((product) =>
      [product.name, product.description].join(' ').toLowerCase().includes(needle),
    );
  }, [products, query]);

  return (
    <div className="space-y-4">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search products"
        className="min-h-11 w-full max-w-md rounded-lg border border-stone-300 bg-white px-3 py-2"
      />
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white p-6 text-stone-600">No products match this search.</div>
      ) : (
        <div>
          <div className="space-y-3 md:hidden">
            {filtered.map((product) => (
              <div key={product.id} className="flex gap-3 rounded-xl border border-stone-200 bg-white p-4">
                {product.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.image_url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="h-16 w-16 shrink-0 rounded-lg bg-stone-100" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{product.name}</p>
                  <p className="truncate text-sm text-stone-500">{product.description}</p>
                  <p className="mt-1">{formatPrice(product.price)}</p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <AvailabilityToggle productId={product.id} available={product.available} />
                    <Link href={`/products/${product.id}`} className="font-medium text-emerald-800">
                      Edit
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden md:block">
            <TableScroll>
              <table className="w-full min-w-[40rem] table-fixed text-left text-base">
                <colgroup>
                  <col className="w-20" />
                  <col />
                  <col className="w-28" />
                  <col className="w-44" />
                  <col className="w-20" />
                </colgroup>
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
                  {filtered.map((product) => (
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
                      <td className="px-4 py-3 align-middle">
                        <AvailabilityToggle productId={product.id} available={product.available} />
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/products/${product.id}`} className="font-medium text-emerald-800">
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </div>
        </div>
      )}
    </div>
  );
}
