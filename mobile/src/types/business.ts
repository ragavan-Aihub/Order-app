export type Business = {
  id: string;
  business_name: string;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  description: string | null;
  banner_url: string | null;
  upi_qr_url?: string | null;
  categories_enabled?: boolean;
  created_at: string;
  updated_at: string;
};
