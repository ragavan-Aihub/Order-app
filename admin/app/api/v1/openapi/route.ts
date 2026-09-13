import { openApiResponse } from '@/lib/partner-openapi';
import { partnerOptions } from '@/lib/partner-api';

export function OPTIONS() {
  return partnerOptions();
}

export async function GET(request: Request) {
  return openApiResponse(request);
}
