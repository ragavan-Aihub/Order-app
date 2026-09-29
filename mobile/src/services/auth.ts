import { env } from '@/config/env';
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
    lower.includes('expired') ||
    lower.includes('invalid otp') ||
    lower.includes('invalid token') ||
    lower.includes('wrong') && lower.includes('otp')
  ) {
    return 'That OTP is invalid or expired. Request a new code and try again.';
  }
  if (lower.includes('unsupported phone provider')) {
    return 'Phone SMS is not enabled in Supabase. Enable Phone and choose Twilio (not Twilio Verify).';
  }
  if (lower.includes('sms provider') || lower.includes('error sending confirmation sms')) {
    return 'Twilio is connected but the SMS was not delivered. On a Twilio trial, the number must be verified in Twilio. For India, enable geo permissions and a DLT-approved sender. Use Twilio SMS, not Twilio Verify.';
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
      options: {
        shouldCreateUser: true,
      },
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
    const { data, error } = await supabase.auth.verifyOtp({
      phone: toE164India(mobile),
      token: token.replace(/\D/g, '').slice(0, 6),
      type: 'sms',
    });

    if (error) {
      throw new Error(mapOtpError(error.message));
    }

    if (!data.session) {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Could not verify OTP. Request a new code and try again.');
      }
    }

    if (!env.businessId) {
      throw new Error('Business is not configured.');
    }

    const { error: profileError } = await supabase.rpc('ensure_customer_profile', {
      p_business_id: env.businessId,
      p_name: null,
      p_mobile: toE164India(mobile),
    });

    if (profileError) {
      if (isNetworkFailure(profileError.message)) {
        throw new Error(OFFLINE_AUTH);
      }
      const lower = profileError.message.toLowerCase();
      if (lower.includes('not authenticated')) {
        throw new Error('Could not verify OTP. Request a new code and try again.');
      }
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
  const { resetAddressBookCache } = await import('@/cart/address-book');
  const { clearDeliveryDraft } = await import('@/cart/delivery-draft');
  resetAddressBookCache();
  await clearDeliveryDraft();
}
