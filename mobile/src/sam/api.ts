import { env } from '@/config/env';
import { getSupabaseClient } from '@/services/supabase';
import type { DraftViewLine, SamTurnMessage, SamTurnResponse } from '@/sam/types';

export type SamTurnContext = {
  recentTurns?: SamTurnMessage[];
  displayedNames?: string[];
  waitingForConfirm?: boolean;
};

export async function sendSamTurn(
  transcript: string,
  draft: DraftViewLine[],
  context?: SamTurnContext,
): Promise<SamTurnResponse> {
  const url = env.samApiUrl.trim();
  if (!url) {
    throw new Error('Voice ordering is not configured. Set EXPO_PUBLIC_SAM_API_URL to your admin /api/sam/turn URL.');
  }
  if (!__DEV__ && !url.toLowerCase().startsWith('https://')) {
    throw new Error('Voice ordering needs a secure (https) server address.');
  }

  const supabase = getSupabaseClient();
  const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : undefined;
  const { getPendingNoteProductId } = await import('@/sam/session');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      transcript,
      businessId: env.businessId,
      draft: draft.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      pendingNoteProductId: getPendingNoteProductId(),
      recentTurns: context?.recentTurns?.slice(-4) ?? [],
      displayedNames: context?.displayedNames?.slice(0, 12) ?? [],
      waitingForConfirm: context?.waitingForConfirm === true,
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || 'Could not process that. Please try again.');
  }

  return (await response.json()) as SamTurnResponse;
}
