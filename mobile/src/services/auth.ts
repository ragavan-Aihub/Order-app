import { env } from '@/config/env';
import { loadDeliveryDraft } from '@/cart/delivery-draft';
import { getIsOffline, isNetworkFailure } from '@/services/network';
import { getSupabaseClient } from '@/services/supabase';
import { toE164India } from '@/utils/validation';

const OFFLINE_AUTH =
  'You are not connected to the internet. Please connect to the internet and try again';

function mapOtpError(message: string) {
  if (isNetworkFailure(message)) {
    return OFFLINE_AUTH;
  }
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
  if (await getIsOffline()) {
    throw new Error(OFFLINE_AUTH);
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  // Test phones (Supabase Auth → Phone → Test OTP) skip the SMS provider.
  // All other numbers use Twilio (or Textlocal) once it is connected in the dashboard.
  try {
    const { error } = await supabase.auth.signInWithOtp({
      phone: toE164India(mobile),
    });

    if (error) {
      throw new Error(mapOtpError(error.message));
    }
  } catch (error) {
    if (isNetworkFailure(error)) {
      throw new Error(OFFLINE_AUTH);
    }
    throw error;
  }
}

export async function verifyOtp(mobile: string, token: string) {
  if (await getIsOffline()) {
    throw new Error(OFFLINE_AUTH);
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  try {
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
      if (isNetworkFailure(profileError.message)) {
        throw new Error(OFFLINE_AUTH);
      }
      throw new Error(profileError.message);
    }
  } catch (error) {
    if (isNetworkFailure(error)) {
      throw new Error(OFFLINE_AUTH);
    }
    throw error;
  }
}

export async function signOut() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  await supabase.auth.signOut();
}
