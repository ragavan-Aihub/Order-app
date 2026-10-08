import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { colors, radius, shadow, spacing } from '@/config/theme';

type PrimaryButtonProps = PressableProps & {
  label: string;
};

export function PrimaryButton({ label, disabled, style, ...rest }: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        typeof style === 'object' && style != null && !Array.isArray(style) ? style : null,
        Array.isArray(style) ? style : null,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      {...rest}
    >
      <Text style={styles.label}>{label}</Text>
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
  label: {
    color: colors.primaryText,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
