import { partnerJson, partnerOptions } from '@/lib/partner-api';
import { partnerOpenApi } from '@/lib/partner-openapi';

export function OPTIONS() {
  return partnerOptions();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return partnerJson({
    name: 'Order Platform Partner API',
    version: '1',
    docs: `${url.origin}/api/v1/openapi`,
    resources: {
      shop: '/api/v1/shop',
      products: '/api/v1/products',
      orders: '/api/v1/orders',
    },
    openapi: partnerOpenApi(url.origin),
  });
}
