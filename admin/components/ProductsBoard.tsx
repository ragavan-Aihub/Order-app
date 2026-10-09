'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { AvailabilityToggle } from '@/components/AvailabilityToggle';
import { ProductCatalogMenu } from '@/components/ProductCatalogMenu';
import { ProductTableThumbnail } from '@/components/ProductTableThumbnail';
import { TableScroll } from '@/components/TableScroll';
import type { Product } from '@/types/product';
import { formatPrice } from '@/utils/format';

export function ProductsBoard({
  products,
  categoriesEnabled = false,
  categories = [],
}: {
  products: Product[];
  categoriesEnabled?: boolean;
  categories?: Array<{ id: string; name: string }>;
}) {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = products.filter((product) => {
      if (statusFilter === 'active' && product.active === false) {
        return false;
      }
      if (statusFilter === 'inactive' && product.active !== false) {
        return false;
      }
      if (categoriesEnabled && categoryFilter === '__none__' && product.category_id) {
        return false;
      }
      if (categoriesEnabled && categoryFilter && categoryFilter !== '__none__' && product.category_id !== categoryFilter) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return [product.name, product.description, product.category_name ?? '']
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
    return rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [categoryFilter, categoriesEnabled, products, query, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search products"
          className="min-h-11 w-full max-w-md rounded-lg border border-stone-300 bg-white px-3 py-2"
        />
        {categoriesEnabled ? (
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="min-h-11 rounded-lg border border-stone-300 bg-white px-3 py-2"
          >
            <option value="">All categories</option>
            <option value="__none__">Uncategorized</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        ) : null}
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}
          aria-label="Filter by status"
          className="min-h-11 rounded-lg border border-stone-300 bg-white px-3 py-2"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <p className="text-sm text-stone-600">
        Inactive hides the product from the app. Coming soon still shows it, blurred, with no Add. Products used in
        orders cannot be deleted — set Inactive instead.
      </p>
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white p-6 text-stone-600">No products match these filters.</div>
      ) : (
        <div>
          <div className="space-y-3 md:hidden">
            {filtered.map((product) => (
              <div key={product.id} className="flex gap-3 rounded-xl border border-stone-200 bg-white p-4">
                <ProductTableThumbnail src={product.image_url} alt={product.name} sizeClass="h-16 w-16" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{product.name}</p>
                  <p className="truncate text-sm text-stone-500">{product.description}</p>
                  {categoriesEnabled ? (
                    <p className="text-xs text-stone-500">{product.category_name ?? 'Uncategorized'}</p>
                  ) : null}
                  <p className="mt-1">{formatPrice(product.price)}</p>
                  <div className="mt-3 flex flex-col gap-2">
                    <ProductCatalogMenu
                      productId={product.id}
                      active={product.active !== false}
                      transacted={Boolean(product.transacted)}
                    />
                    <AvailabilityToggle
                      productId={product.id}
                      available={product.available}
                      disabled={product.active === false}
                    />
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
                  {categoriesEnabled ? <col className="w-36" /> : null}
                  <col className="w-44" />
                  <col className="w-20" />
                </colgroup>
                <thead className="bg-stone-50 text-stone-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Image</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Price</th>
                    {categoriesEnabled ? <th className="px-4 py-3 font-medium">Category</th> : null}
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium"> </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((product) => (
                    <tr key={product.id} className="border-t border-stone-200">
                      <td className="px-4 py-3">
                        <ProductTableThumbnail src={product.image_url} alt={product.name} />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-stone-500">{product.description}</p>
                      </td>
                      <td className="px-4 py-3">{formatPrice(product.price)}</td>
                      {categoriesEnabled ? (
                        <td className="px-4 py-3 text-stone-600">{product.category_name ?? '—'}</td>
                      ) : null}
                      <td className="px-4 py-3 align-middle">
                        <div className="flex flex-col gap-2">
                          <ProductCatalogMenu
                            productId={product.id}
                            active={product.active !== false}
                            transacted={Boolean(product.transacted)}
                          />
                          <AvailabilityToggle
                            productId={product.id}
                            available={product.available}
                            disabled={product.active === false}
                          />
                        </div>
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
