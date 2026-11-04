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
import { requestOtp, verifyOtp } from '@/services/auth';
import { refreshBusiness } from '@/services/business';
import { isNetworkFailure } from '@/services/network';
import type { Business } from '@/types/business';

const BRAND_GREEN = '#0F7B38';
const BRAND_DARK = '#14532D';
const WASH_GREEN = '#DDF1E3';
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
  const params = useLocalSearchParams<{ mobile?: string; next?: string }>();
  const mobile = firstParam(params.mobile);
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
    if (secondsLeft <= 0) {
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  async function onResend() {
    if (!mobile || resending || secondsLeft > 0) {
      return;
    }
    setError(null);
    setResending(true);
    try {
      if (!(await requireConnection())) {
        return;
      }
      await requestOtp(mobile);
      setOtp('');
      setSecondsLeft(RESEND_SECONDS);
    } catch (sendError) {
      if (isNetworkFailure(sendError)) {
        await requireConnection();
        return;
      }
      setError(sendError instanceof Error ? sendError.message : 'Could not resend OTP.');
    } finally {
      setResending(false);
    }
  }

  async function onVerify() {
    setError(null);
    if (!mobile) {
      setError('Mobile number is missing.');
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
      await verifyOtp(mobile, digits);
      await markEnteredShop();
      await loadAddressBook();
      const destination =
        next === 'checkout'
          ? '/checkout'
          : next === 'cart'
            ? '/cart'
            : next === 'orders'
              ? '/orders'
              : next === 'buy-again' || next === 'reorder'
                ? '/buy-again'
                : next === 'account'
                  ? '/account'
                  : next === 'sam'
                    ? '/sam'
                    : '/home';
      router.replace(destination);
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

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={22} color={BRAND_DARK} />
        </Pressable>
        <Text style={styles.headerTitle}>Verify OTP</Text>
        <View style={styles.back} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, spacing.lg) + 48 },
        ]}
      >
        <View style={styles.sheet}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.logo} contentFit="cover" />
          ) : (
            <View style={styles.logoFallback}>
              <Text style={styles.initial}>{shopInitial(shopName)}</Text>
            </View>
          )}

          <Text style={styles.title}>Enter OTP</Text>
          <Text style={styles.message}>We've sent a 6-digit OTP to</Text>

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

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            onPress={onVerify}
            disabled={verifying}
            style={styles.verify}
            accessibilityRole="button"
          >
            <Text style={styles.verifyLabel}>{verifying ? 'Verifying…' : 'Verify'}</Text>
          </Pressable>

          {secondsLeft > 0 ? (
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
            <Ionicons name="shield-checkmark" size={22} color={BRAND_GREEN} />
            <Text style={styles.securityText}>For your security, do not share this OTP with anyone.</Text>
          </View>
        </View>
      </ScrollView>
      <View pointerEvents="none" style={styles.bottomWave} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WASH_GREEN,
    paddingHorizontal: spacing.sm,
    paddingBottom: 28,
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
  content: {
    flexGrow: 1,
    marginTop: -20,
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
  logo: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: '#F4F4F5',
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
