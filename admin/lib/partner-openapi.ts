import { partnerJson } from '@/lib/partner-api';

export function partnerOpenApi(origin: string) {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Order Platform Partner API',
      version: '1.0.0',
      description:
        'Place and track orders for a shop from an app, website, or messaging channel. Authenticate with an API key. Orders appear in the same shop order list as the customer app.',
    },
    servers: [{ url: `${origin}/api/v1` }],
    security: [{ apiKey: [] }, { bearer: [] }],
    components: {
      securitySchemes: {
        apiKey: { type: 'apiKey', in: 'header', name: 'X-Api-Key' },
        bearer: { type: 'http', scheme: 'bearer' },
      },
    },
    paths: {
      '/shop': { get: { summary: 'Shop profile', operationId: 'getShop' } },
      '/products': { get: { summary: 'Available products', operationId: 'listProducts' } },
      '/products/{id}': { get: { summary: 'Product', operationId: 'getProduct' } },
      '/orders': {
        get: { summary: 'Recent orders', operationId: 'listOrders' },
        post: {
          summary: 'Place an order',
          operationId: 'createOrder',
          description: 'Creates an order. Set external_id for partner or WhatsApp retries (idempotent).',
        },
      },
      '/orders/{id}': { get: { summary: 'Order by id, order number, or external_id', operationId: 'getOrder' } },
    },
  };
}

export function openApiResponse(request: Request) {
  const url = new URL(request.url);
  return partnerJson(partnerOpenApi(url.origin));
}
