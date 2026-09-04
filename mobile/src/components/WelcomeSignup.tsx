import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Keyboard,
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

import { colors, spacing } from '@/config/theme';
import { requestOtp } from '@/services/auth';
import { isValidIndianMobile } from '@/utils/validation';

const LOGO = require('../../assets/images/farm2flavours-label.jpg');

type WelcomeSignupProps = {
  allowSkip: boolean;
  next?: string;
  initialMobile?: string;
};

export function WelcomeSignup({ allowSkip, next = 'products', initialMobile = '' }: WelcomeSignupProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [mobile, setMobile] = useState(initialMobile.replace(/\D/g, '').slice(-10));
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const canContinue = isValidIndianMobile(mobile) && !sending;

  useEffect(() => {
    const digits = initialMobile.replace(/\D/g, '').slice(-10);
    if (digits) {
      setMobile(digits);
    }
  }, [initialMobile]);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      setKeyboardVisible(false);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  async function onContinue() {
    setError(null);
    if (!isValidIndianMobile(mobile)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }

    setSending(true);
    try {
      await requestOtp(mobile);
      router.push({ pathname: '/verify', params: { mobile, next } });
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Could not send OTP.');
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.sm,
            paddingBottom: insets.bottom + spacing.md,
          },
        ]}
      >
        <View style={styles.topBar}>
          <View />
          {allowSkip ? (
            <Pressable
              onPress={() => router.replace('/products')}
              style={styles.skip}
              accessibilityRole="button"
            >
              <Text style={styles.skipLabel}>Skip</Text>
            </Pressable>
          ) : (
            <View />
          )}
        </View>

        <View style={styles.hero}>
          <Image source={LOGO} style={keyboardVisible ? styles.logoCompact : styles.logo} contentFit="cover" />
          {keyboardVisible ? null : (
            <>
              <Text style={styles.headline}>Fresh homemade food,{'\n'}delivered to your door</Text>
              <Text style={styles.tagline}>Pure Nature. Pure Taste. Pure Trust.</Text>
            </>
          )}
        </View>

        <View style={styles.form}>
          <View style={styles.phoneRow}>
            <Text style={styles.prefix}>+91</Text>
            <TextInput
              value={mobile}
              onChangeText={(value) => setMobile(value.replace(/\D/g, '').slice(0, 10))}
              placeholder="Enter Phone Number"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              style={styles.phoneInput}
            />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            onPress={onContinue}
            disabled={!canContinue}
            style={[styles.continue, !canContinue && styles.continueDisabled]}
            accessibilityRole="button"
          >
            <Text style={[styles.continueLabel, !canContinue && styles.continueLabelDisabled]}>
              {sending ? 'Sending…' : 'Continue'}
            </Text>
          </Pressable>
          {!allowSkip ? (
            <Text style={styles.hint}>Sign in with this number to place your order.</Text>
          ) : (
            <Text style={styles.hint}>You can skip and sign in later when adding the delivery address.</Text>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4EEE3',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 40,
  },
  skip: {
    backgroundColor: '#E8E4DC',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
  },
  skipLabel: {
    color: '#B42318',
    fontSize: 16,
    fontWeight: '700',
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  logo: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 6,
    borderColor: '#C8A44A',
  },
  logoCompact: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    borderColor: '#C8A44A',
  },
  headline: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1B4D2E',
    textAlign: 'center',
    lineHeight: 34,
  },
  tagline: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
  },
  form: {
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    minHeight: 56,
  },
  prefix: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginRight: spacing.sm,
  },
  phoneInput: {
    flex: 1,
    fontSize: 18,
    color: colors.text,
    paddingVertical: 12,
  },
  continue: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: '#1B4D2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueDisabled: {
    backgroundColor: '#D6D3D1',
  },
  continueLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primaryText,
  },
  continueLabelDisabled: {
    color: '#78716C',
  },
  error: {
    fontSize: 15,
    color: colors.danger,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
