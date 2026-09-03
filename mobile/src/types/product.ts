export type Product = {
  id: string;
  business_id: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  available: boolean;
  created_at: string;
  updated_at: string;
};
