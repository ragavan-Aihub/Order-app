export type UserRole = 'customer' | 'admin';

export type Profile = {
  id: string;
  mobile: string;
  name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
};
