import { Ionicons } from '@expo/vector-icons';
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
import { useNetworkStatus } from '@/network/NetworkProvider';
import { requestOtp } from '@/services/auth';
import { getBusiness, peekCachedBusiness, refreshBusiness } from '@/services/business';
import { isNetworkFailure } from '@/services/network';
import { isValidIndianMobile } from '@/utils/validation';
import type { Business } from '@/types/business';

const BRAND_GREEN = '#0F7B38';
const BRAND_DARK = '#14532D';
const DEFAULT_TAGLINE = 'Fresh products, delivered to your doorstep.';
const WASH_GREEN = '#DDF1E3';

type WelcomeSignupProps = {
  allowSkip: boolean;
  next?: string;
  initialMobile?: string;
  linkGoogle?: boolean;
};

function shopInitial(name: string) {
  const letter = name.trim().charAt(0).toUpperCase();
  return letter || '?';
}

export function WelcomeSignup({
  allowSkip,
  next = 'home',
  initialMobile = '',
  linkGoogle = false,
}: WelcomeSignupProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { requireConnection } = useNetworkStatus();
  const [mobile, setMobile] = useState(initialMobile.replace(/\D/g, '').slice(-10));
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [business, setBusiness] = useState<Business | null>(() => peekCachedBusiness());
  const [shopLoaded, setShopLoaded] = useState(() => peekCachedBusiness() != null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const shopName = business?.business_name?.trim() ?? '';
  const tagline = business?.description?.trim() || DEFAULT_TAGLINE;
  const logoUrl = business?.logo_url?.trim() || '';
  const bannerUrl = business?.banner_url?.trim() || '';
  const showBanner = !keyboardVisible && Boolean(bannerUrl);
  const [bannerAspect, setBannerAspect] = useState(3);

  useEffect(() => {
    let active = true;
    getBusiness()
      .then((shop) => {
        if (!active) {
          return;
        }
        if (shop) {
          setBusiness(shop);
        }
        setShopLoaded(true);
      })
      .catch(() => {
        if (active) {
          setShopLoaded(true);
        }
      });
    refreshBusiness()
      .then((shop) => {
        if (active && shop) {
          setBusiness(shop);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
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
      if (!(await requireConnection())) {
        return;
      }
      await requestOtp(mobile);
      router.push({ pathname: '/verify', params: { mobile, next } });
    } catch (sendError) {
      if (isNetworkFailure(sendError)) {
        await requireConnection();
        return;
      }
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
          {linkGoogle ? (
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              style={styles.skip}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="arrow-back" size={22} color={BRAND_DARK} />
            </Pressable>
          ) : (
            <View />
          )}
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

        <View style={[styles.hero, !showBanner && !keyboardVisible && styles.heroCentered]}>
          {logoUrl ? (
            <Image
              source={{ uri: logoUrl }}
              style={keyboardVisible ? styles.logoCompact : styles.logo}
              contentFit="cover"
            />
          ) : shopLoaded ? (
            <View style={[styles.logoFallback, keyboardVisible && styles.logoCompact]}>
              <Text style={keyboardVisible ? styles.initialCompact : styles.initial}>
                {shopInitial(shopName)}
              </Text>
            </View>
          ) : null}
          {keyboardVisible ? null : (
            <View style={styles.titlePatch}>
              {shopName ? <Text style={styles.headline}>{shopName}</Text> : null}
              <Text style={styles.tagline}>{tagline}</Text>
            </View>
          )}
        </View>

        {showBanner ? (
          <Image
            source={{ uri: bannerUrl }}
            style={[styles.banner, { aspectRatio: bannerAspect }]}
            contentFit="contain"
            onLoad={(event) => {
              const width = event.source.width;
              const height = event.source.height;
              if (width > 0 && height > 0) {
                setBannerAspect(width / height);
              }
            }}
          />
        ) : null}

        <View style={styles.form}>
          <View style={styles.phoneRow}>
            <View style={styles.prefixGroup}>
              <Text style={styles.prefix}>+91</Text>
              <Ionicons name="chevron-down" size={18} color={BRAND_DARK} />
            </View>
            <View style={styles.divider} />
            <TextInput
              value={mobile}
              onChangeText={(value) => setMobile(value.replace(/\D/g, '').slice(0, 10))}
              placeholder="Enter mobile number"
              placeholderTextColor="#8A8A8A"
              keyboardType="phone-pad"
              style={styles.phoneInput}
            />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            onPress={onContinue}
            disabled={sending}
            style={styles.continue}
            accessibilityRole="button"
          >
            <Text style={styles.continueLabel}>{sending ? 'Sending…' : 'Continue'}</Text>
          </Pressable>
          <View style={styles.otpNote}>
            <Ionicons name="shield-checkmark-outline" size={26} color={BRAND_GREEN} />
            <Text style={styles.otpNoteText}>
              We'll send a one-time password (OTP) to verify your number.
            </Text>
          </View>
          <Text style={styles.hint}>
            We'll send a one-time code to this number so we know it is yours. That opens earlier orders placed with this number.
          </Text>
        </View>

        <View style={[styles.spacer, showBanner && styles.spacerGrow]} />

        <View style={styles.legalWrap}>
          <Text style={styles.legal}>
            By continuing, you agree to our{' '}
            <Text
              style={styles.legalLink}
              onPress={() => router.push('/privacy')}
              accessibilityRole="link"
            >
              Privacy Policy
            </Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: WASH_GREEN,
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
    paddingHorizontal: spacing.xs,
    paddingVertical: 8,
  },
  skipLabel: {
    color: BRAND_GREEN,
    fontSize: 18,
    fontWeight: '700',
  },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  heroCentered: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  titlePatch: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#FFFFFF',
    borderRadius: '50%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  logo: {
    width: 148,
    height: 148,
    borderRadius: 32,
    backgroundColor: '#F4F4F5',
    shadowColor: '#14532D',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  logoCompact: {
    width: 80,
    height: 80,
    borderRadius: 20,
  },
  logoFallback: {
    width: 148,
    height: 148,
    borderRadius: 32,
    backgroundColor: '#E8F6EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontSize: 56,
    fontWeight: '800',
    color: BRAND_GREEN,
  },
  initialCompact: {
    fontSize: 32,
    fontWeight: '800',
    color: BRAND_GREEN,
  },
  headline: {
    fontSize: 34,
    fontWeight: '800',
    color: BRAND_DARK,
    textAlign: 'center',
    lineHeight: 40,
  },
  tagline: {
    fontSize: 22,
    lineHeight: 30,
    color: '#3F3F46',
    textAlign: 'center',
  },
  banner: {
    width: '100%',
    aspectRatio: 3,
    marginBottom: spacing.md,
    backgroundColor: WASH_GREEN,
  },
  form: {
    gap: spacing.md,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#DADADA',
    borderRadius: 22,
    paddingHorizontal: spacing.md,
    minHeight: 64,
  },
  prefixGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  prefix: {
    fontSize: 20,
    fontWeight: '800',
    color: BRAND_DARK,
  },
  divider: {
    width: 1.5,
    alignSelf: 'stretch',
    backgroundColor: '#DADADA',
    marginHorizontal: spacing.md,
    marginVertical: 14,
  },
  phoneInput: {
    flex: 1,
    fontSize: 20,
    color: colors.text,
    paddingVertical: 12,
  },
  continue: {
    minHeight: 58,
    borderRadius: 22,
    backgroundColor: BRAND_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND_GREEN,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  continueLabel: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  error: {
    fontSize: 15,
    color: colors.danger,
  },
  otpNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  otpNoteText: {
    flex: 1,
    fontSize: 17,
    lineHeight: 24,
    color: '#3F3F46',
  },
  hint: {
    marginTop: spacing.xs,
    fontSize: 17,
    lineHeight: 25,
    color: '#52525B',
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  spacer: {
    minHeight: spacing.lg,
  },
  spacerGrow: {
    flexGrow: 1,
  },
  legalWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D4D4D8',
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  legal: {
    fontSize: 15,
    lineHeight: 22,
    color: '#52525B',
    textAlign: 'center',
  },
  legalLink: {
    color: BRAND_GREEN,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
});
