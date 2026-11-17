import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';

import { colors, radius, shadow, spacing } from '@/config/theme';
import { hapticTap } from '@/utils/haptics';

type PrimaryButtonProps = PressableProps & {
  label: string;
  /** Shows a spinner and blocks double-taps while work is in flight. */
  busy?: boolean;
};

export function PrimaryButton({ label, disabled, busy, style, onPress, ...rest }: PrimaryButtonProps) {
  const blocked = Boolean(disabled || busy);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy: Boolean(busy) }}
      disabled={blocked}
      style={({ pressed }) => [
        styles.button,
        typeof style === 'object' && style != null && !Array.isArray(style) ? style : null,
        Array.isArray(style) ? style : null,
        pressed && !busy && styles.pressed,
        blocked && styles.disabled,
      ]}
      {...rest}
      onPress={(event) => {
        if (blocked) {
          return;
        }
        hapticTap();
        onPress?.(event);
      }}
    >
      {busy ? (
        <View style={styles.busyRow}>
          <ActivityIndicator size="small" color={colors.primaryText} />
          <Text style={styles.label}>{label}</Text>
        </View>
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    minHeight: 54,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    ...shadow.md,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    color: colors.primaryText,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
