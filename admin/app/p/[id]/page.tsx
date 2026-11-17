import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ProductOpenClient } from '@/components/ProductOpenClient';
import { getPublicProductForShare } from '@/services/public-product';

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await getPublicProductForShare(id);
  const title = product?.name ? `${product.name} · Farm2Flavour` : 'Farm2Flavour';
  const description =
    product?.description?.trim() || 'Open this product in the Farm2Flavour app.';
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: product?.imageUrl ? [{ url: product.imageUrl }] : undefined,
    },
  };
}

export default async function PublicProductOpenPage({ params }: PageProps) {
  const { id } = await params;
  const product = await getPublicProductForShare(id);
  if (!product) {
    notFound();
  }

  return (
    <div className="min-h-dvh bg-[#f7f4ef] text-stone-900">
      <header className="border-b border-stone-200 bg-white px-5 py-3">
        <p className="text-sm font-extrabold tracking-tight text-teal-900">Farm2Flavour</p>
      </header>
      <ProductOpenClient
        productId={product.id}
        name={product.name}
        description={product.description}
        imageUrl={product.imageUrl}
      />
    </div>
  );
}
