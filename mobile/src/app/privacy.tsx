import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, type ComponentProps } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/config/theme';
import { getBusiness } from '@/services/business';
import type { Business } from '@/types/business';

type IconName = ComponentProps<typeof Ionicons>['name'];

const ITEMS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'call-outline',
    title: 'Your mobile number',
    body: 'Used to send a one-time sign-in code and to recognise your account.',
  },
  {
    icon: 'location-outline',
    title: 'Your name and address',
    body: 'Used only to prepare and deliver your order.',
  },
  {
    icon: 'receipt-outline',
    title: 'Your orders',
    body: 'Items, totals, and whether you will pay by cash or UPI at delivery are kept so the shop can fulfil and support your order.',
  },
  {
    icon: 'notifications-outline',
    title: 'Notifications',
    body: 'If you allow them, the app saves a push token so the shop can tell you when an order is confirmed, on the way, or delivered.',
  },
  {
    icon: 'card-outline',
    title: 'Payment',
    body: 'The app does not take card payments. You pay the person who delivers your order.',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Your information',
    body: 'We do not sell your personal information.',
  },
];

export default function PrivacyScreen() {
  const [business, setBusiness] = useState<Business | null>(null);

  useEffect(() => {
    getBusiness().then(setBusiness).catch(() => setBusiness(null));
  }, []);

  const shopName = business?.business_name?.trim() || 'This shop';
  const phone = business?.phone?.trim() || '';
  const email = business?.email?.trim() || '';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        {shopName} operates this app so you can browse products and place delivery orders. Here is what we use and why.
      </Text>

      <View style={styles.card}>
        {ITEMS.map((item, index) => (
          <View key={item.title} style={[styles.row, index > 0 && styles.rowDivider]}>
            <View style={styles.iconWrap}>
              <Ionicons name={item.icon} size={20} color={colors.primary} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowBody}>{item.body}</Text>
            </View>
          </View>
        ))}
      </View>

      {phone || email ? (
        <View style={styles.card}>
          <Text style={styles.contactTitle}>Questions?</Text>
          {phone ? <Text style={styles.contactLine}>Call {phone}</Text> : null}
          {email ? <Text style={styles.contactLine}>Email {email}</Text> : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  intro: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
    color: colors.text,
  },
  rowBody: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  contactTitle: {
    marginTop: spacing.sm,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  contactLine: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textMuted,
  },
});
