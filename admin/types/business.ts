export type Business = {
  id: string;
  business_name: string;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  description: string | null;
  banner_url: string | null;
  shop_closed: boolean;
  shop_closed_message: string | null;
  min_order_amount?: number | null;
  announcement_active: boolean;
  announcement_title: string | null;
  announcement_body: string | null;
  announcement_image_url: string | null;
  created_at: string;
  updated_at: string;
};
