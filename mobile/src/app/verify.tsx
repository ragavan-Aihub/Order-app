import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { loadAddressBook } from '@/cart/address-book';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, spacing } from '@/config/theme';
import { useNetworkStatus } from '@/network/NetworkProvider';
import { requestOtp, verifyOtp } from '@/services/auth';
import { isNetworkFailure } from '@/services/network';
import { markEnteredShop } from '@/nav/shop-entry';

function firstParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export default function VerifyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mobile?: string; next?: string }>();
  const mobile = firstParam(params.mobile);
  const next = firstParam(params.next);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const { requireConnection } = useNetworkStatus();

  async function onResend() {
    if (!mobile || resending) {
      return;
    }
    setError(null);
    setResending(true);
    try {
      if (!(await requireConnection())) {
        return;
      }
      await requestOtp(mobile);
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
    if (otp.replace(/\D/g, '').length !== 6) {
      setError('Enter the 6-digit OTP sent to your phone.');
      return;
    }

    setVerifying(true);
    try {
      if (!(await requireConnection())) {
        return;
      }
      await verifyOtp(mobile, otp);
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
                    : next === 'account'
                      ? '/account'
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
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, spacing.md) },
        ]}
      >
        <Text style={styles.title}>Enter OTP</Text>
        <Text style={styles.message}>OTP sent to {mobile}</Text>
        {__DEV__ ? (
          <Text style={styles.testHint}>
            Test number 9940206706 uses code 121212 (no SMS). Other numbers need Twilio SMS to
            India — not Twilio Verify.
          </Text>
        ) : null}
        <TextInput
          value={otp}
          onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
          placeholder="OTP"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={6}
          style={styles.input}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label={verifying ? 'Verifying…' : 'Verify'} disabled={verifying} onPress={onVerify} />
        <Pressable onPress={onResend} disabled={resending} accessibilityRole="button">
          <Text style={styles.resend}>{resending ? 'Sending…' : 'Resend OTP'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
  },
  testHint: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  error: {
    fontSize: 16,
    color: colors.danger,
  },
  resend: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
});
