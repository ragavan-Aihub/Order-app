import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { loadAddressBook } from '@/cart/address-book';
import { spacing } from '@/config/theme';
import { markEnteredShop } from '@/nav/shop-entry';
import { useNetworkStatus } from '@/network/NetworkProvider';
import { requestEmailOtp, requestOtp, verifyOtp } from '@/services/auth';
import { refreshBusiness } from '@/services/business';
import { isNetworkFailure } from '@/services/network';
import { getSignedInUser, getSupabaseClient } from '@/services/supabase';
import type { Business } from '@/types/business';

const BRAND_GREEN = '#1B7A3A';
const BRAND_DARK = '#14532D';
const WASH_GREEN = '#DDF1E3';
const CREAM = '#F3F6EC';
const RESEND_SECONDS = 30;
const OTP_LENGTH = 6;

function firstParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function formatMobile(value?: string) {
  const digits = (value ?? '').replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) {
    return value ?? '';
  }
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

function shopInitial(name: string) {
  const letter = name.trim().charAt(0).toUpperCase();
  return letter || '?';
}

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export default function VerifyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mobile?: string; email?: string; next?: string }>();
  const mobile = firstParam(params.mobile);
  const email = firstParam(params.email);
  const next = firstParam(params.next);
  const inputRef = useRef<TextInput>(null);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [business, setBusiness] = useState<Business | null>(null);
  const { requireConnection } = useNetworkStatus();

  const shopName = business?.business_name?.trim() ?? '';
  const logoUrl = business?.logo_url?.trim() || '';
  const digits = otp.replace(/\D/g, '').slice(0, OTP_LENGTH);

  function openKeypad() {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    input.blur();
    setTimeout(() => input.focus(), 50);
  }

  useEffect(() => {
    refreshBusiness().then(setBusiness).catch(() => setBusiness(null));
  }, []);

  useEffect(() => {
    if (!email) {
      return;
    }
    let active = true;
    void getSignedInUser().then((user) => {
      if (active && user) void goToApp();
    });
    const supabase = getSupabaseClient();
    if (!supabase) {
      return;
    }
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session && active) {
        void goToApp();
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [email]);

  useEffect(() => {
    if (secondsLeft <= 0) {
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  async function onResend() {
    if ((!mobile && !email) || resending || secondsLeft > 0) {
      return;
    }
    setError(null);
    setResending(true);
    try {
      if (!(await requireConnection())) {
        return;
      }
      if (email) {
        await requestEmailOtp(email);
      } else {
        await requestOtp(mobile ?? '');
      }
      setOtp('');
      setSecondsLeft(RESEND_SECONDS);
    } catch (sendError) {
      if (isNetworkFailure(sendError)) {
        await requireConnection();
        return;
      }
      setError(sendError instanceof Error ? sendError.message : email ? 'Could not resend the email.' : 'Could not resend OTP.');
    } finally {
      setResending(false);
    }
  }

  const destination =
    next === 'checkout'
      ? '/checkout'
      : next === 'cart'
        ? '/cart'
        : next === 'orders'
          ? '/orders'
          : next === 'buy-again' || next === 'reorder'
            ? '/buy-again'
            : next === 'sam'
              ? '/sam'
              : '/home';

  async function goToApp() {
    await markEnteredShop();
    await loadAddressBook();
    router.replace(destination);
  }

  async function onVerify() {
    setError(null);
    if (!mobile && !email) {
      setError('Sign-in details are missing.');
      return;
    }
    if (digits.length !== OTP_LENGTH) {
      setError('Enter the 6-digit OTP sent to your phone.');
      return;
    }

    setVerifying(true);
    try {
      if (!(await requireConnection())) {
        return;
      }
      await verifyOtp(mobile ?? '', digits);
      await goToApp();
    } catch (verifyError) {
      if (isNetworkFailure(verifyError)) {
        await requireConnection();
        return;
      }
      setError(verifyError instanceof Error ? verifyError.message : 'Could not verify OTP.');
    } finally {
      setVerifying(false);
    }
  }

  const waitingForEmail = Boolean(email);

  return (
    <KeyboardAvoidingView
      style={[styles.screen, waitingForEmail && styles.screenCream]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, waitingForEmail && styles.headerCream, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={26} color={BRAND_DARK} />
        </Pressable>
        <Text style={[styles.headerTitle, waitingForEmail && styles.headerTitleLeft]}>
          {waitingForEmail ? 'Check your email' : 'Verify OTP'}
        </Text>
        {waitingForEmail ? null : <View style={styles.back} />}
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          waitingForEmail && styles.contentEmail,
          { paddingBottom: Math.max(insets.bottom, spacing.lg) + (waitingForEmail ? 16 : 48) },
        ]}
        scrollEnabled={!waitingForEmail}
      >
        <View style={[styles.sheet, waitingForEmail && styles.sheetEmail]}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={[styles.logo, waitingForEmail && styles.logoRound]} contentFit="cover" />
          ) : (
            <View style={[styles.logoFallback, waitingForEmail && styles.logoRound]}>
              <Text style={styles.initial}>{shopInitial(shopName)}</Text>
            </View>
          )}

          <Text style={styles.title}>{waitingForEmail ? 'Open your email' : 'Enter OTP'}</Text>
          <Text style={[styles.message, waitingForEmail && styles.messageCenter]}>
            {waitingForEmail
              ? 'Look for “Your sign-in link” or “Confirm your email address” from Supabase Auth. Tap Sign in. That is this shop finishing sign-in. There is no code to type.'
              : "We've sent a 6-digit code to"}
          </Text>

          {waitingForEmail ? (
            <View style={styles.emailCard}>
              <View style={styles.emailIcon}>
                <Ionicons name="mail" size={18} color={BRAND_GREEN} />
              </View>
              <Text style={styles.emailAddress} numberOfLines={2}>
                {email}
              </Text>
              <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
                accessibilityRole="button"
              >
                <Text style={styles.changeLabel}>Change</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.phoneRow}>
              <Ionicons name="call" size={18} color={BRAND_GREEN} />
              <Text style={styles.phone}>{formatMobile(mobile)}</Text>
              <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
                style={styles.change}
                accessibilityRole="button"
              >
                <Text style={styles.changeLabel}>Change</Text>
              </Pressable>
            </View>
          )}

          {waitingForEmail ? null : (
            <>
              <Pressable onPress={openKeypad} style={styles.otpRow} accessibilityRole="none">
                {Array.from({ length: OTP_LENGTH }, (_, index) => {
                  const filled = Boolean(digits[index]);
                  const active = digits.length === index;
                  return (
                    <View
                      key={index}
                      style={[styles.otpBox, (filled || active) && styles.otpBoxActive]}
                    >
                      <Text style={styles.otpDigit}>{digits[index] ?? ''}</Text>
                    </View>
                  );
                })}
              </Pressable>
              <TextInput
                ref={inputRef}
                value={digits}
                onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                maxLength={OTP_LENGTH}
                autoFocus
                caretHidden
                style={styles.hiddenInput}
              />
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {waitingForEmail ? null : (
            <Pressable
              onPress={onVerify}
              disabled={verifying}
              style={styles.verify}
              accessibilityRole="button"
            >
              <Text style={styles.verifyLabel}>{verifying ? 'Verifying…' : 'Verify'}</Text>
            </Pressable>
          )}

          {waitingForEmail ? (
            <Pressable
              onPress={onResend}
              disabled={resending || secondsLeft > 0}
              style={styles.resendPill}
              accessibilityRole="button"
            >
              <Text style={styles.resendPillLabel}>
                {resending
                  ? 'Sending…'
                  : secondsLeft > 0
                    ? `Resend email in ${formatCountdown(secondsLeft)}`
                    : 'Resend email'}
              </Text>
            </Pressable>
          ) : secondsLeft > 0 ? (
            <View style={styles.resendRow}>
              <Ionicons name="time-outline" size={18} color="#71717A" />
              <Text style={styles.resendMuted}>
                Resend OTP in <Text style={styles.resendTime}>{formatCountdown(secondsLeft)}</Text>
              </Text>
            </View>
          ) : (
            <Pressable onPress={onResend} disabled={resending} accessibilityRole="button">
              <Text style={styles.resendAction}>{resending ? 'Sending…' : 'Resend OTP'}</Text>
            </Pressable>
          )}

          <View style={styles.security}>
            <Ionicons
              name={waitingForEmail ? 'checkmark-circle' : 'shield-checkmark'}
              size={22}
              color={BRAND_GREEN}
            />
            <Text style={styles.securityText}>
              {waitingForEmail
                ? 'You just asked us to write to this address. Open that mail on this phone, tap the link, then come back here.'
                : 'For your security, do not share this OTP with anyone.'}
            </Text>
          </View>
        </View>
      </ScrollView>
      {waitingForEmail ? null : <View pointerEvents="none" style={styles.bottomWave} />}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  screenCream: {
    backgroundColor: CREAM,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WASH_GREEN,
    paddingHorizontal: spacing.sm,
    paddingBottom: 28,
  },
  headerCream: {
    backgroundColor: CREAM,
    paddingBottom: spacing.sm,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: BRAND_DARK,
  },
  headerTitleLeft: {
    textAlign: 'left',
    fontSize: 22,
    fontWeight: '800',
  },
  content: {
    flexGrow: 1,
    marginTop: -20,
  },
  contentEmail: {
    marginTop: 0,
    paddingHorizontal: spacing.lg,
  },
  sheet: {
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  sheetEmail: {
    backgroundColor: 'transparent',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingHorizontal: 0,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: '#F4F4F5',
  },
  logoRound: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  logoFallback: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: '#E8F6EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontSize: 34,
    fontWeight: '800',
    color: BRAND_GREEN,
  },
  title: {
    marginTop: spacing.xs,
    fontSize: 26,
    fontWeight: '800',
    color: BRAND_DARK,
  },
  message: {
    fontSize: 16,
    color: '#52525B',
  },
  messageCenter: {
    textAlign: 'center',
    lineHeight: 24,
    color: '#4B5C4B',
    paddingHorizontal: spacing.sm,
  },
  emailCard: {
    alignSelf: 'stretch',
    minHeight: 64,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emailIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F3E4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailAddress: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: BRAND_DARK,
    lineHeight: 22,
  },
  resendPill: {
    alignSelf: 'stretch',
    minHeight: 52,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#C8D9C4',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  resendPillLabel: {
    fontSize: 17,
    fontWeight: '800',
    color: BRAND_GREEN,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  phone: {
    fontSize: 18,
    fontWeight: '800',
    color: '#18181B',
  },
  change: {
    marginLeft: spacing.xs,
    backgroundColor: '#E8F6EC',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  changeLabel: {
    color: BRAND_GREEN,
    fontSize: 14,
    fontWeight: '700',
  },
  otpRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.md,
  },
  otpBox: {
    width: 46,
    height: 54,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E4E4E7',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  otpBoxActive: {
    borderColor: BRAND_GREEN,
  },
  otpDigit: {
    fontSize: 22,
    fontWeight: '700',
    color: '#18181B',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
  error: {
    fontSize: 15,
    color: '#B91C1C',
    textAlign: 'center',
  },
  verify: {
    alignSelf: 'stretch',
    minHeight: 56,
    marginTop: spacing.sm,
    borderRadius: 28,
    backgroundColor: BRAND_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyLabel: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xs,
  },
  resendMuted: {
    fontSize: 15,
    color: '#71717A',
  },
  resendTime: {
    color: BRAND_GREEN,
    fontWeight: '800',
  },
  resendAction: {
    marginTop: spacing.xs,
    fontSize: 16,
    fontWeight: '800',
    color: BRAND_GREEN,
  },
  security: {
    alignSelf: 'stretch',
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#E8F6EC',
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  securityText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: '#3F3F46',
  },
  bottomWave: {
    position: 'absolute',
    left: -40,
    right: -40,
    bottom: -36,
    height: 90,
    borderTopLeftRadius: 160,
    borderTopRightRadius: 160,
    backgroundColor: WASH_GREEN,
  },
});
