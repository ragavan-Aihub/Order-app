export type Product = {
  id: string;
  business_id: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  available: boolean;
  category_id?: string | null;
  created_at: string;
  updated_at: string;
};
