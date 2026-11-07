import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { loadAddressBook } from '@/cart/address-book';
import { colors, spacing } from '@/config/theme';
import { markEnteredShop } from '@/nav/shop-entry';
import { useNetworkStatus } from '@/network/NetworkProvider';
import { requestEmailOtp } from '@/services/auth';
import { getBusiness, peekCachedBusiness, refreshBusiness } from '@/services/business';
import { destinationFor, rememberAuthNext, signInWithGoogle } from '@/services/google-auth';
import { isNetworkFailure } from '@/services/network';
import { getSignedInUser, getSupabaseClient } from '@/services/supabase';
import type { Business } from '@/types/business';
import { isValidEmail } from '@/utils/validation';

const CREAM = '#F3F6EC';
const TITLE = '#14532D';
const MUTED = '#5C6B5C';
const GREEN = '#1B7A3A';
const LINE = '#D7E3D4';

type GoogleSignInProps = {
  allowSkip: boolean;
  next?: string;
};

type Panel = 'menu' | 'email';

function shopInitial(name: string) {
  const letter = name.trim().charAt(0).toUpperCase();
  return letter || '?';
}

export function GoogleSignIn({ allowSkip, next = 'home' }: GoogleSignInProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { requireConnection } = useNetworkStatus();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<Panel>('menu');
  const [email, setEmail] = useState('');
  const [business, setBusiness] = useState<Business | null>(() => peekCachedBusiness());
  const [shopLoaded, setShopLoaded] = useState(() => peekCachedBusiness() != null);
  const leaving = useRef(false);

  const shopName = business?.business_name?.trim() ?? '';
  const tagline = business?.description?.trim() || 'Freshness and goodness, delivered to your doorstep.';
  const logoUrl = business?.logo_url?.trim() || '';

  useEffect(() => {
    let active = true;
    getBusiness()
      .then((shop) => {
        if (!active) return;
        if (shop) setBusiness(shop);
        setShopLoaded(true);
      })
      .catch(() => {
        if (active) setShopLoaded(true);
      });
    refreshBusiness()
      .then((shop) => {
        if (active && shop) setBusiness(shop);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  async function goSignedIn() {
    if (leaving.current) return;
    leaving.current = true;
    await markEnteredShop();
    await loadAddressBook();
    router.replace(destinationFor(next));
  }

  useEffect(() => {
    let active = true;
    void getSignedInUser().then((user) => {
      if (active && user) void goSignedIn();
    });
    const supabase = getSupabaseClient();
    const { data } = supabase?.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) void goSignedIn();
    }) ?? { data: { subscription: { unsubscribe() {} } } };
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [next]);

  async function onGoogle() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await rememberAuthNext(next);
      if (!(await requireConnection())) return;
      const user = await getSignedInUser();
      if (user) {
        await goSignedIn();
        return;
      }
      const outcome = await signInWithGoogle();
      if (leaving.current) return;
      if (outcome.status === 'cancelled') return;
      if (outcome.status === 'error') {
        setError(outcome.message);
        return;
      }
      await goSignedIn();
    } finally {
      if (!leaving.current) setBusy(false);
    }
  }

  async function onEmail() {
    setError(null);
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    try {
      if (!(await requireConnection())) return;
      await rememberAuthNext(next);
      await requestEmailOtp(email.trim());
      router.push({ pathname: '/verify', params: { email: email.trim().toLowerCase(), next } });
    } catch (sendError) {
      if (isNetworkFailure(sendError)) {
        await requireConnection();
        return;
      }
      setError(sendError instanceof Error ? sendError.message : 'Could not send the confirmation email.');
    } finally {
      setBusy(false);
    }
  }

  const legalReserve = 48 + Math.max(insets.bottom, 12);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + 4,
            paddingBottom: legalReserve,
          },
        ]}
      >
        <View style={styles.topBar}>
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
              <Ionicons name="chevron-forward" size={16} color={GREEN} />
            </Pressable>
          ) : (
            <View />
          )}
        </View>

        <View style={styles.hero}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.logo} contentFit="cover" />
          ) : shopLoaded ? (
            <View style={styles.logoFallback}>
              <Text style={styles.initial}>{shopInitial(shopName)}</Text>
            </View>
          ) : null}
          <Text style={styles.welcome}>Welcome to</Text>
          {shopName ? <Text style={styles.headline}>{shopName}</Text> : null}
          <Text style={styles.tagline}>{tagline}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign in or create an account</Text>

          {panel === 'menu' ? (
            <>
              <Pressable
                onPress={onGoogle}
                disabled={busy}
                style={styles.google}
                accessibilityRole="button"
                accessibilityLabel="Continue with Google"
              >
                <Ionicons name="logo-google" size={18} color="#FFFFFF" />
                <Text style={styles.googleLabel}>{busy ? 'Opening Google…' : 'Continue with Google'}</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setError(null);
                  setPanel('email');
                }}
                disabled={busy}
                style={styles.outline}
                accessibilityRole="button"
              >
                <Ionicons name="mail-outline" size={20} color={TITLE} />
                <Text style={styles.outlineTitle}>Continue with Email</Text>
              </Pressable>
              <Text style={styles.outlineHint}>We'll send a sign-in link. Continue with Google is quicker if you already use Gmail.</Text>
            </>
          ) : null}

          {panel === 'email' ? (
            <>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email address"
                placeholderTextColor="#8A8A8A"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                style={styles.field}
              />
              <Pressable onPress={onEmail} disabled={busy} style={styles.google} accessibilityRole="button">
                <Text style={styles.googleLabel}>{busy ? 'Sending…' : 'Send confirmation email'}</Text>
              </Pressable>
              <Text style={styles.outlineHint}>The mail comes from Supabase Auth. That is the sign-in service this shop uses.</Text>
              <Pressable onPress={() => setPanel('menu')} style={styles.backLink} accessibilityRole="button">
                <Text style={styles.backLinkLabel}>All sign-in options</Text>
              </Pressable>
            </>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <View style={styles.trustRow}>
          <View style={styles.trust}>
            <Ionicons name="leaf-outline" size={22} color={GREEN} />
            <Text style={styles.trustLabel}>Homemade{'\n'}Products</Text>
          </View>
          <View style={styles.trustSplit} />
          <View style={styles.trust}>
            <Ionicons name="bicycle-outline" size={22} color={GREEN} />
            <Text style={styles.trustLabel}>Doorstep{'\n'}Delivery</Text>
          </View>
          <View style={styles.trustSplit} />
          <View style={styles.trust}>
            <Ionicons name="shield-checkmark-outline" size={22} color={GREEN} />
            <Text style={styles.trustLabel}>Fresh &{'\n'}Trusted</Text>
          </View>
        </View>
      </View>

      <View style={[styles.legalBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Text style={styles.legal}>
          By continuing, you agree to our{' '}
          <Text style={styles.legalLink} onPress={() => router.push('/privacy')} accessibilityRole="link">
            Privacy Policy
          </Text>
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: CREAM,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between',
  },
  topBar: {
    minHeight: 36,
    alignItems: 'flex-end',
  },
  skip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: '#D3E4CC',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  skipLabel: {
    color: GREEN,
    fontSize: 15,
    fontWeight: '700',
  },
  hero: {
    alignItems: 'center',
    gap: 6,
    paddingBottom: spacing.sm,
    flexShrink: 1,
  },
  logo: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: '#FFFFFF',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  logoFallback: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: '#E4F0DC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontSize: 40,
    fontWeight: '800',
    color: GREEN,
  },
  welcome: {
    marginTop: spacing.sm,
    fontSize: 26,
    fontWeight: '600',
    color: TITLE,
    textAlign: 'center',
  },
  headline: {
    fontSize: 28,
    fontWeight: '800',
    color: TITLE,
    textAlign: 'center',
    marginTop: -2,
  },
  tagline: {
    marginTop: 4,
    fontSize: 15,
    lineHeight: 22,
    color: MUTED,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 22,
    paddingHorizontal: 18,
    gap: 12,
    shadowColor: '#14532D',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TITLE,
    textAlign: 'center',
    marginBottom: 4,
  },
  google: {
    minHeight: 52,
    borderRadius: 28,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  googleLabel: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  outline: {
    minHeight: 52,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#C8D9C4',
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
  },
  outlineTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: TITLE,
  },
  outlineHint: {
    fontSize: 13,
    lineHeight: 18,
    color: MUTED,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
    marginTop: -2,
  },
  field: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: LINE,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  backLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  backLinkLabel: {
    color: GREEN,
    fontWeight: '700',
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.danger,
    textAlign: 'center',
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  trust: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  trustLabel: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
    color: TITLE,
    fontWeight: '600',
  },
  trustSplit: {
    width: StyleSheet.hairlineWidth,
    height: 40,
    backgroundColor: '#C5D4C0',
  },
  legalBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1A4D2E',
    paddingTop: 12,
    paddingHorizontal: spacing.md,
  },
  legal: {
    color: '#E7F3E0',
    textAlign: 'center',
    fontSize: 13,
  },
  legalLink: {
    color: '#FFFFFF',
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
});
