import { MOCK_PRODUCTS } from '@/data/mock-products';
import type { Product } from '@/types/product';

export async function getAvailableProducts(): Promise<Product[]> {
  return MOCK_PRODUCTS.filter((product) => product.available);
}

export async function getProductById(id: string): Promise<Product | null> {
  return MOCK_PRODUCTS.find((product) => product.id === id) ?? null;
}
