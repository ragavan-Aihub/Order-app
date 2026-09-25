export type ProductCategory = {
  id: string;
  business_id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductCategoryListItem = ProductCategory & {
  productCount: number;
};
