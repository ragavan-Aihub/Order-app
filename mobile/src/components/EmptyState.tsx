import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/config/theme';

type EmptyStateProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={styles.button} accessibilityRole="button">
          <Text style={styles.buttonLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '700',
  },
});
