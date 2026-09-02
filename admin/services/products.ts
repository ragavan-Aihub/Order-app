import { MOCK_PRODUCTS } from '@/data/mock-products';
import type { Product } from '@/types/product';

export async function getAllProducts(): Promise<Product[]> {
  return MOCK_PRODUCTS;
}
