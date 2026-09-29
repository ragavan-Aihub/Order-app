import { NextResponse } from 'next/server';

import { isSupabaseConfigured } from '@/config/env';
import { processSamTurn } from '@/lib/sam/process-turn';
import type { SamTurnRequest } from '@/lib/sam/types';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return json({ error: 'API is not configured.' }, 503);
  }

  let body: SamTurnRequest;
  try {
    body = (await request.json()) as SamTurnRequest;
  } catch {
    return json({ error: 'JSON body required.' }, 400);
  }

  if (!body?.transcript?.trim() || !body.businessId) {
    return json({ error: 'transcript and businessId are required.' }, 400);
  }

  const auth = request.headers.get('authorization');
  const token = auth?.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : null;

  try {
    const result = await processSamTurn(
      {
        transcript: body.transcript.trim().slice(0, 500),
        businessId: body.businessId,
        draft: Array.isArray(body.draft) ? body.draft : [],
        pendingNoteProductId: body.pendingNoteProductId ?? null,
      },
      token,
    );
    return json(result);
  } catch (error) {
    console.info('[sam]', 'turn_error', error instanceof Error ? error.message : 'error');
    return json({ error: 'Could not process that request.' }, 500);
  }
}
