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
import { markEnteredShop } from '@/nav/shop-entry';
import { requestOtp } from '@/services/auth';
import { getBusiness } from '@/services/business';
import { isValidIndianMobile } from '@/utils/validation';
import type { Business } from '@/types/business';

const FALLBACK_LOGO = require('../../assets/images/farm2flavours-label.jpg');

type WelcomeSignupProps = {
  allowSkip: boolean;
  next?: string;
  initialMobile?: string;
};

export function WelcomeSignup({ allowSkip, next = 'home', initialMobile = '' }: WelcomeSignupProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [mobile, setMobile] = useState(initialMobile.replace(/\D/g, '').slice(-10));
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [business, setBusiness] = useState<Business | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const canContinue = isValidIndianMobile(mobile) && !sending;

  useEffect(() => {
    getBusiness().then(setBusiness).catch(() => setBusiness(null));
  }, []);

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
              onPress={async () => {
                await markEnteredShop();
                router.replace('/home');
              }}
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
          <Image
            source={business?.logo_url ? { uri: business.logo_url } : FALLBACK_LOGO}
            style={keyboardVisible ? styles.logoCompact : styles.logo}
            contentFit="cover"
          />
          {keyboardVisible ? null : (
            <>
              <Text style={styles.headline}>{business?.business_name ?? 'Welcome'}</Text>
              <Text style={styles.tagline}>
                {business?.description?.trim() || 'Browse the catalog and place an order.'}
              </Text>
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
    backgroundColor: colors.background,
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
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  skipLabel: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '600',
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  logo: {
    width: 160,
    height: 160,
    borderRadius: 32,
    backgroundColor: colors.border,
  },
  logoCompact: {
    width: 88,
    height: 88,
    borderRadius: 20,
    backgroundColor: colors.border,
  },
  headline: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
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
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueDisabled: {
    backgroundColor: colors.border,
  },
  continueLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primaryText,
  },
  continueLabelDisabled: {
    color: colors.textMuted,
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
