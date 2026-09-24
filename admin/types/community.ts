export type Community = {
  id: string;
  business_id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type CommunityListItem = Community & {
  customerCount: number;
  orderCount: number;
};

export type CommunityMappedAddress = {
  addressId: string;
  customerId: string | null;
  name: string;
  mobile: string;
  addressLine: string;
};

export type CommunityCustomerOption = {
  customerId: string;
  name: string;
  mobile: string;
  addresses: Array<{
    id: string;
    line: string;
    communityId: string | null;
    communityName: string | null;
  }>;
};

export function deliveryTypeLabel(order: {
  community_id?: string | null;
  community_name?: string | null;
}) {
  return order.community_name?.trim() || order.community_id ? 'Community' : 'Individual';
}
