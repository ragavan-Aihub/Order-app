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
  /** Android versionCode. Builds below this must update. 0 = off. */
  customer_app_min_version_code?: number | null;
  /** Android versionCode of the newest customer build. 0 = off. */
  customer_app_latest_version_code?: number | null;
  customer_app_latest_version?: string | null;
  customer_app_release_kind?: 'none' | 'bugfix' | 'feature' | null;
  customer_app_release_notes?: string | null;
  customer_app_update_url?: string | null;
  created_at: string;
  updated_at: string;
};
