import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, spacing } from '@/config/theme';
import { verifyOtp } from '@/services/auth';

export default function VerifyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mobile, next } = useLocalSearchParams<{ mobile?: string; next?: string }>();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function onVerify() {
    setError(null);
    if (!mobile) {
      setError('Mobile number is missing.');
      return;
    }
    if (otp.trim().length < 4) {
      setError('Enter the OTP sent to your phone.');
      return;
    }

    setVerifying(true);
    try {
      await verifyOtp(mobile, otp);
      const destination =
        next === 'checkout' ? '/checkout' : next === 'orders' ? '/orders' : '/products';
      router.replace(destination);
    } catch (verifyError) {
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
        <TextInput
          value={otp}
          onChangeText={setOtp}
          placeholder="OTP"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          style={styles.input}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label={verifying ? 'Verifying…' : 'Verify'} disabled={verifying} onPress={onVerify} />
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
});
