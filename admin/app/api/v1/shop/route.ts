import { partnerJson, partnerOptions, partnerRpc, readApiKey } from '@/lib/partner-api';

export function OPTIONS() {
  return partnerOptions();
}

export async function GET(request: Request) {
  const apiKey = readApiKey(request);
  if (!apiKey) {
    return partnerJson({ error: { code: 'unauthorized', message: 'Missing API key.' } }, 401);
  }
  const result = await partnerRpc('partner_shop', { p_api_key: apiKey });
  if (result.response) {
    return result.response;
  }
  return partnerJson({ data: result.data });
}
