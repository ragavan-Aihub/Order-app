import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { colors, spacing } from '@/config/theme';

type PrimaryButtonProps = PressableProps & {
  label: string;
};

export function PrimaryButton({ label, disabled, ...rest }: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
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
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    color: colors.primaryText,
    fontSize: 18,
    fontWeight: '600',
  },
});
