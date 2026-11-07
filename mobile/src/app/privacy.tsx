import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '@/config/theme';
import { getBusiness } from '@/services/business';
import type { Business } from '@/types/business';

type IconName = ComponentProps<typeof Ionicons>['name'];

const CREAM = '#F3F6EC';
const TITLE = '#14532D';
const MUTED = '#4B5C4B';
const GREEN = '#1B7A3A';
const ICON_WASH = '#DDEED8';

const ITEMS: { kind: 'google' | 'ion'; icon?: IconName; title: string; body: string }[] = [
  {
    kind: 'google',
    title: 'Your Google account',
    body: 'Used to sign you in. We keep the name and email Google shares so the shop can recognise your account. You can also sign in with email using a confirmation link.',
  },
  {
    kind: 'ion',
    icon: 'location',
    title: 'Your name and address',
    body: 'Used only to prepare and deliver your order.',
  },
  {
    kind: 'ion',
    icon: 'receipt',
    title: 'Your orders',
    body: 'Items, totals, and whether you will pay by cash or UPI at delivery are kept so the shop can fulfil and support your order.',
  },
  {
    kind: 'ion',
    icon: 'notifications',
    title: 'Notifications',
    body: 'If you allow them, the app saves a push token so the shop can tell you when an order is confirmed, on the way, or delivered.',
  },
  {
    kind: 'ion',
    icon: 'cash',
    title: 'Payment',
    body: 'The app does not take card payments. You pay the person who delivers your order.',
  },
  {
    kind: 'ion',
    icon: 'shield-checkmark',
    title: 'Your information',
    body: 'We do not sell your personal information.',
  },
];

function GoogleMark() {
  return (
    <View style={styles.googleBadge}>
      <Text style={styles.googleG}>G</Text>
    </View>
  );
}

function displayPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return phone;
}

function telHref(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `tel:+91${digits}`;
  }
  if (digits.length > 0) {
    return `tel:+${digits}`;
  }
  return `tel:${phone}`;
}

export default function PrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [business, setBusiness] = useState<Business | null>(null);

  useEffect(() => {
    getBusiness().then(setBusiness).catch(() => setBusiness(null));
  }, []);

  const shopName = business?.business_name?.trim() || 'This shop';
  const phone = business?.phone?.trim() || '';
  const email = business?.email?.trim() || '';

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={26} color={TITLE} />
        </Pressable>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          {shopName} operates this app so you can browse products and place delivery orders. Here is what we use and why.
        </Text>

        {ITEMS.map((item) => (
          <View key={item.title} style={styles.card}>
            {item.kind === 'google' ? (
              <GoogleMark />
            ) : (
              <View style={styles.iconWrap}>
                <Ionicons name={item.icon!} size={22} color={GREEN} />
              </View>
            )}
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowBody}>{item.body}</Text>
            </View>
          </View>
        ))}

        {phone || email ? (
          <View style={styles.questions}>
            <Text style={styles.questionsTitle}>Questions?</Text>
            {phone ? (
              <Pressable
                onPress={() => void Linking.openURL(telHref(phone))}
                style={styles.contactPill}
                accessibilityRole="link"
              >
                <Ionicons name="call-outline" size={18} color={TITLE} />
                <Text style={styles.contactLabel}>Call {displayPhone(phone)}</Text>
              </Pressable>
            ) : null}
            {email ? (
              <Pressable
                onPress={() => void Linking.openURL(`mailto:${email}`)}
                style={styles.contactPill}
                accessibilityRole="link"
              >
                <Ionicons name="mail-outline" size={18} color={TITLE} />
                <Text style={styles.contactLabel} numberOfLines={1}>
                  Email {email}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: CREAM,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    gap: 4,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: TITLE,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.md,
    gap: 12,
  },
  intro: {
    fontSize: 16,
    lineHeight: 24,
    color: TITLE,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  googleBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EEE4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleG: {
    fontSize: 22,
    fontWeight: '800',
    color: '#4285F4',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ICON_WASH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 4,
    paddingTop: 2,
  },
  rowTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    color: TITLE,
  },
  rowBody: {
    fontSize: 14,
    lineHeight: 21,
    color: MUTED,
  },
  questions: {
    backgroundColor: '#E4F0DC',
    borderRadius: 22,
    padding: 14,
    gap: 10,
  },
  questionsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: TITLE,
    paddingHorizontal: 4,
  },
  contactPill: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  contactLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: TITLE,
  },
});
