import { partnerJson, partnerOptions, partnerRpc, readApiKey } from '@/lib/partner-api';

export function OPTIONS() {
  return partnerOptions();
}

export async function GET(request: Request) {
  const apiKey = readApiKey(request);
  if (!apiKey) {
    return partnerJson({ error: { code: 'unauthorized', message: 'Missing API key.' } }, 401);
  }
  const result = await partnerRpc('partner_list_orders', { p_api_key: apiKey });
  if (result.response) {
    return result.response;
  }
  return partnerJson({ data: result.data ?? [] });
}

export async function POST(request: Request) {
  const apiKey = readApiKey(request);
  if (!apiKey) {
    return partnerJson({ error: { code: 'unauthorized', message: 'Missing API key.' } }, 401);
  }

  let body: {
    customer?: { name?: string; mobile?: string; address?: string; pincode?: string };
    items?: { product_id?: string; quantity?: number }[];
    external_id?: string;
  };
  try {
    body = await request.json();
  } catch {
    return partnerJson({ error: { code: 'invalid_request', message: 'JSON body required.' } }, 400);
  }

  const result = await partnerRpc('partner_place_order', {
    p_api_key: apiKey,
    p_customer_name: body.customer?.name ?? '',
    p_mobile: body.customer?.mobile ?? '',
    p_address: body.customer?.address ?? '',
    p_pincode: body.customer?.pincode ?? '',
    p_items: body.items ?? [],
    p_external_id: body.external_id ?? null,
  });
  if (result.response) {
    return result.response;
  }
  return partnerJson({ data: result.data }, 201);
}
