export type Product = {
  id: string;
  business_id: string;
  name: string;
  description: string;
  ingredients?: string | null;
  price: number;
  image_url: string | null;
  available: boolean;
  active?: boolean;
  category_id?: string | null;
  created_at: string;
  updated_at: string;
};
