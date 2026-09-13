import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { env, isSupabaseConfigured } from '@/config/env';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Api-Key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'X-Api-Version': '1',
};

export function partnerOptions() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export function partnerJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

export function partnerClient() {
  if (!isSupabaseConfigured) {
    return null;
  }
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function readApiKey(request: Request): string | null {
  const bearer = request.headers.get('authorization');
  if (bearer?.toLowerCase().startsWith('bearer ')) {
    return bearer.slice(7).trim();
  }
  const header = request.headers.get('x-api-key');
  return header?.trim() || null;
}

export function mapPartnerError(message: string | undefined) {
  const text = message ?? '';
  if (text.includes('UNAUTHORIZED')) {
    return partnerJson({ error: { code: 'unauthorized', message: 'Invalid API key.' } }, 401);
  }
  if (text.includes('FORBIDDEN')) {
    return partnerJson({ error: { code: 'forbidden', message: 'This key cannot use this endpoint.' } }, 403);
  }
  if (text.includes('NOT_FOUND') || text.includes('PRODUCT_UNAVAILABLE')) {
    return partnerJson({ error: { code: 'not_found', message: 'Not found.' } }, 404);
  }
  if (text.includes('INVALID_')) {
    return partnerJson({ error: { code: 'invalid_request', message: 'Check customer details and items.' } }, 400);
  }
  return partnerJson({ error: { code: 'error', message: 'Could not complete the request.' } }, 400);
}

export async function partnerRpc<T>(fn: string, args: Record<string, unknown>): Promise<{ data: T | null; response?: NextResponse }> {
  const supabase = partnerClient();
  if (!supabase) {
    return {
      data: null,
      response: partnerJson({ error: { code: 'unavailable', message: 'API is not configured.' } }, 503),
    };
  }
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    return { data: null, response: mapPartnerError(error.message) };
  }
  return { data: data as T };
}
