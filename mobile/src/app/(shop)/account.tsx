import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTopInset } from '@/utils/safe-area';

import {
  formatSavedAddressLabel,
  formatSavedAddressLine,
  getSelectedAddress,
  loadAddressBook,
  type SavedAddress,
} from '@/cart/address-book';
import { useCart } from '@/cart/CartContext';
import { LABEL_ICONS } from '@/components/AddressPickerSheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, radius, shadow, spacing } from '@/config/theme';
import { signOut } from '@/services/auth';
import { getBusiness } from '@/services/business';
import { getCustomerProfile } from '@/services/orders';
import { getSignedInUser } from '@/services/supabase';
import type { Business } from '@/types/business';
import type { AddressLabel } from '@/utils/address';

function formatMobile(value: string | null) {
  const digits = (value ?? '').replace(/\D/g, '').slice(-10);
  return digits.length === 10 ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : null;
}

function shopDigits(phone: string | null | undefined) {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length >= 11 && digits.length <= 15) {
    return digits;
  }
  return '';
}

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export default function AccountScreen() {
  const router = useRouter();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const topInset = useTopInset();
  const { clearCart, refreshOpenOrder } = useCart();
  const [signedIn, setSignedIn] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [mobile, setMobile] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<SavedAddress | null>(null);
  const [shop, setShop] = useState<Business | null>(null);

  const load = useCallback(async () => {
    const user = await getSignedInUser();
    setSignedIn(Boolean(user));
    await loadAddressBook();
    const business = await getBusiness().catch(() => null);
    setShop(business);
    if (!user) {
      setName(null);
      setMobile(null);
      setDelivery(null);
      return;
    }
    const profile = await getCustomerProfile();
    const saved = getSelectedAddress();
    const profileName = profile?.name?.trim() || '';
    const generic = !profileName || profileName.toLowerCase() === 'customer';
    const metadata = user.user_metadata ?? {};
    const googleName =
      (typeof metadata.full_name === 'string' && metadata.full_name.trim()) ||
      (typeof metadata.name === 'string' && metadata.name.trim()) ||
      '';
    setName(generic ? saved?.name?.trim() || googleName || null : profileName);
    setMobile(profile?.mobile || user.phone || saved?.mobile || null);
    setDelivery(saved);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  const initial = signedIn && name?.trim() ? name.trim().charAt(0).toUpperCase() : null;
  const addressLine = delivery ? formatSavedAddressLine(delivery) : '';
  const addressLabel = (delivery?.label ?? 'home') as AddressLabel;
  const supportPhone = shopDigits(shop?.phone);
  const supportEmail = shop?.email?.trim() || '';

  function openAddress() {
    if (signedIn) {
      router.push('/checkout');
      return;
    }
    router.push({ pathname: '/login', params: { next: 'checkout' } });
  }

  return (
    <View style={styles.screen}>
      {focused ? <StatusBar style="light" /> : null}
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.lg }}
      >
        <View style={[styles.header, { paddingTop: topInset + spacing.md }]}>
          <View style={styles.headerGlow} pointerEvents="none" />
          <View style={styles.avatar}>
            {initial ? (
              <Text style={styles.avatarLabel}>{initial}</Text>
            ) : (
              <Ionicons name="person" size={28} color={colors.primary} />
            )}
          </View>
          <View style={styles.profileText}>
            <Text style={styles.name} numberOfLines={1}>
              {signedIn ? name || 'Welcome' : 'Welcome'}
            </Text>
            {signedIn && formatMobile(mobile) ? (
              <View style={styles.phoneRow}>
                <Ionicons name="call" size={13} color="rgba(255,255,255,0.9)" />
                <Text style={styles.phone} numberOfLines={1}>
                  {formatMobile(mobile)}
                </Text>
              </View>
            ) : signedIn ? null : (
              <Text style={styles.phone} numberOfLines={2}>
                Sign in to see orders and save your profile.
              </Text>
            )}
          </View>
          {signedIn ? (
            <Pressable
              onPress={openAddress}
              style={styles.editBtn}
              accessibilityRole="button"
              accessibilityLabel="Edit delivery details"
              hitSlop={8}
            >
              <Ionicons name="pencil" size={18} color={colors.primaryText} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.body}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          <Pressable
            style={({ pressed }) => [styles.delivery, pressed && styles.pressed]}
            onPress={openAddress}
            accessibilityRole="button"
            accessibilityLabel={delivery ? 'Change delivery address' : 'Add delivery address'}
          >
            <View style={styles.deliveryIcon}>
              <Ionicons name={LABEL_ICONS[addressLabel]} size={18} color={colors.primary} />
            </View>
            <View style={styles.deliveryBody}>
              {delivery ? (
                <>
                  <View style={styles.deliveryTitleRow}>
                    <Text style={styles.deliveryTitle} numberOfLines={1}>
                      {formatSavedAddressLabel(delivery.label)}
                    </Text>
                    <View style={styles.defaultPill}>
                      <Text style={styles.defaultPillText}>Default</Text>
                    </View>
                  </View>
                  <Text style={styles.address} numberOfLines={3}>
                    {addressLine}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.deliveryTitle}>No address yet</Text>
                  <Text style={styles.address}>Add one before you place an order.</Text>
                </>
              )}
            </View>
            <View style={styles.changePill}>
              <Text style={styles.change}>{delivery ? 'Change' : 'Add'}</Text>
            </View>
          </Pressable>

          <Text style={styles.sectionTitle}>Help & Support</Text>
          <View style={styles.helpList}>
            {supportPhone ? (
              <HelpRow
                icon="logo-whatsapp"
                title="WhatsApp support"
                subtitle="Chat with our team"
                external
                onPress={() =>
                  void Linking.openURL(
                    `https://wa.me/${supportPhone}?text=${encodeURIComponent('Hi, I need help with my order.')}`,
                  )
                }
              />
            ) : null}
            {supportPhone ? (
              <HelpRow
                icon="call"
                title="Call support"
                subtitle="Speak with our team"
                external
                onPress={() => void Linking.openURL(`tel:+${supportPhone}`)}
              />
            ) : null}
            {supportEmail ? (
              <HelpRow
                icon="mail"
                title="Email support"
                subtitle="Send us your questions"
                onPress={() => void Linking.openURL(`mailto:${supportEmail}`)}
              />
            ) : null}
            <HelpRow
              icon="help-circle"
              title="FAQs"
              subtitle="Find answers to common questions"
              onPress={() => router.push('/faqs')}
            />
          </View>

          {signedIn ? (
            <Pressable
              onPress={async () => {
                await signOut();
                clearCart();
                refreshOpenOrder();
                await load();
              }}
              style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Ionicons name="log-out-outline" size={18} color="#DC2626" />
              <Text style={styles.signOut}>Sign out</Text>
            </Pressable>
          ) : (
            <PrimaryButton
              label="Sign in"
              onPress={() => router.push({ pathname: '/login', params: { next: 'home' } })}
            />
          )}

          <Text style={styles.version}>App version {APP_VERSION}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function HelpRow({
  icon,
  title,
  subtitle,
  onPress,
  external = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  external?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.helpRow, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.helpIcon}>
        <Ionicons name={icon} size={18} color="#15803D" />
      </View>
      <View style={styles.helpText}>
        <Text style={styles.helpTitle}>{title}</Text>
        <Text style={styles.helpSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name={external ? 'open-outline' : 'chevron-forward'} size={18} color="#15803D" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: spacing.lg,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    backgroundColor: '#128A3E',
    overflow: 'hidden',
  },
  headerGlow: {
    position: 'absolute',
    top: -80,
    right: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#D1FAE5',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    fontSize: 26,
    fontWeight: '800',
    color: '#166534',
  },
  profileText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  name: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    color: colors.primaryText,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phone: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    gap: 0,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
    marginLeft: 2,
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  delivery: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: '#F0FDF4',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#BBF7D0',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    marginBottom: spacing.lg,
  },
  deliveryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  deliveryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deliveryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    flexShrink: 1,
  },
  defaultPill: {
    backgroundColor: '#BBF7D0',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  defaultPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  address: {
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textMuted,
  },
  changePill: {
    backgroundColor: '#DCFCE7',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  change: {
    fontSize: 14,
    fontWeight: '800',
    color: '#15803D',
  },
  pressed: {
    opacity: 0.85,
  },
  helpList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    ...shadow.sm,
  },
  helpIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  helpTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  helpSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
  signOutButton: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: '#FEF2F2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  signOut: {
    fontSize: 16,
    fontWeight: '800',
    color: '#DC2626',
  },
  version: {
    marginTop: spacing.lg,
    textAlign: 'center',
    fontSize: 13,
    color: colors.textMuted,
  },
});
