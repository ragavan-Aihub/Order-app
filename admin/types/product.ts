import type { PackOption, SellingType } from '@/lib/selling-units';

export type Product = {
  id: string;
  business_id: string;
  name: string;
  description: string;
  ingredients?: string | null;
  price: number;
  selling_type?: SellingType;
  selling_unit?: string | null;
  price_per_kg?: number | null;
  minimum_weight_grams?: number | null;
  maximum_weight_grams?: number | null;
  packs?: PackOption[];
  image_url: string | null;
  available: boolean;
  active?: boolean;
  category_id?: string | null;
  category_name?: string | null;
  transacted?: boolean;
  created_at: string;
  updated_at: string;
};
