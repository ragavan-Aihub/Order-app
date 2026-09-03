export type UserRole = 'customer' | 'admin';

export type Profile = {
  id: string;
  email: string | null;
  mobile: string | null;
  name: string | null;
  role: UserRole;
  business_id: string | null;
  created_at: string;
  updated_at: string;
};
