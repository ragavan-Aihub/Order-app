import { env } from '@/config/env';
import { loadDeliveryDraft } from '@/cart/delivery-draft';
import { getSupabaseClient } from '@/services/supabase';
import { toE164India } from '@/utils/validation';

export async function requestOtp(mobile: string) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { error } = await supabase.auth.signInWithOtp({
    phone: toE164India(mobile),
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function verifyOtp(mobile: string, token: string) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { error } = await supabase.auth.verifyOtp({
    phone: toE164India(mobile),
    token: token.trim(),
    type: 'sms',
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!env.businessId) {
    throw new Error('Business is not configured.');
  }

  const draft = await loadDeliveryDraft();
  const { error: profileError } = await supabase.rpc('ensure_customer_profile', {
    p_business_id: env.businessId,
    p_name: draft?.name ?? null,
    p_mobile: toE164India(mobile),
  });

  if (profileError) {
    throw new Error(profileError.message);
  }
}
