import { partnerJson, partnerOptions, partnerRpc, readApiKey } from '@/lib/partner-api';

export function OPTIONS() {
  return partnerOptions();
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const apiKey = readApiKey(request);
  if (!apiKey) {
    return partnerJson({ error: { code: 'unauthorized', message: 'Missing API key.' } }, 401);
  }
  const { id } = await context.params;
  const result = await partnerRpc('partner_get_order', { p_api_key: apiKey, p_order_ref: id });
  if (result.response) {
    return result.response;
  }
  return partnerJson({ data: result.data });
}
