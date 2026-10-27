import { Image } from 'expo-image';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/config/theme';
import { formatPrice } from '@/utils/format';

export function UpiPayBlock({ qrUrl, amount }: { qrUrl: string; amount: number }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Pay with UPI</Text>
      <Text style={styles.subtitle}>Scan to pay {formatPrice(amount)} to the shop.</Text>
      <View style={styles.qrFrame}>
        <Image source={{ uri: qrUrl }} style={styles.qr} contentFit="contain" />
      </View>
    </View>
  );
}

export function UpiPayBlockLoading() {
  return (
    <View style={[styles.card, styles.loading]}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceInset,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  loading: {
    paddingVertical: spacing.lg,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    alignSelf: 'flex-start',
  },
  subtitle: {
    color: colors.textMuted,
    alignSelf: 'flex-start',
  },
  qrFrame: {
    width: '100%',
    maxWidth: 260,
    aspectRatio: 1,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  qr: {
    width: '100%',
    height: '100%',
  },
});
