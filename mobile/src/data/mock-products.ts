import { MOCK_BUSINESS_ID } from '@/config/constants';
import type { Product } from '@/types/product';

/** Temporary local catalog used until products are loaded from Supabase. */
export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'mock-1',
    business_id: MOCK_BUSINESS_ID,
    name: 'Homemade Mango Pickle',
    description: 'Sun-ripened mango pickle made in small batches with traditional spices.',
    price: 220,
    image_url: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=800',
    available: true,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'mock-2',
    business_id: MOCK_BUSINESS_ID,
    name: 'Millet Energy Laddoo',
    description: 'Roasted millet, jaggery, and ghee rolled into wholesome snack laddoos.',
    price: 180,
    image_url: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800',
    available: true,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'mock-3',
    business_id: MOCK_BUSINESS_ID,
    name: 'Farm Honey',
    description: 'Raw, unprocessed honey collected from local farm hives.',
    price: 350,
    image_url: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800',
    available: true,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'mock-4',
    business_id: MOCK_BUSINESS_ID,
    name: 'Seasonal Fruit Preserve',
    description: 'Limited seasonal preserve. Currently marked unavailable for customers.',
    price: 260,
    image_url: 'https://images.unsplash.com/photo-1471943311424-646960669fbc?w=800',
    available: false,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
  },
];
