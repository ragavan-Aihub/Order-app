import { env } from '@/config/env';
import { loadDeliveryDraft } from '@/cart/delivery-draft';
import { getSupabaseClient } from '@/services/supabase';
import { toE164India } from '@/utils/validation';

function mapOtpError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes('rate') || lower.includes('after 60') || lower.includes('too many')) {
    return 'Wait about a minute, then request a new OTP.';
  }
  if (
    lower.includes('unsupported phone provider') ||
    lower.includes('sms provider') ||
    lower.includes('error sending confirmation sms')
  ) {
    return 'Live SMS is not connected yet. Use the test mobile number, or add Twilio in Supabase Auth.';
  }
  return message;
}

export async function requestOtp(mobile: string) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  // Test phones (Supabase Auth → Phone → Test OTP) skip the SMS provider.
  // All other numbers use Twilio (or Textlocal) once it is connected in the dashboard.
  const { error } = await supabase.auth.signInWithOtp({
    phone: toE164India(mobile),
  });

  if (error) {
    throw new Error(mapOtpError(error.message));
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
    throw new Error(mapOtpError(error.message));
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

export async function signOut() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  await supabase.auth.signOut();
}
