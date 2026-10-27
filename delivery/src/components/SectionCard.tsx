import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { colors, radius, shadow, spacing } from '@/config/theme';

export function SectionCard({
  title,
  children,
  compact,
  style,
  ...rest
}: ViewProps & { title: string; children: ReactNode; compact?: boolean }) {
  return (
    <View style={[styles.card, compact && styles.cardCompact, style]} {...rest}>
      <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
    gap: spacing.sm,
  },
  cardCompact: {
    padding: spacing.sm,
    gap: 6,
    borderRadius: radius.sm,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  titleCompact: {
    fontSize: 11,
    marginBottom: -2,
  },
});
