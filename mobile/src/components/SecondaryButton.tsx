import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { colors, spacing } from '@/config/theme';

type SecondaryButtonProps = PressableProps & {
  label: string;
};

export function SecondaryButton({ label, disabled, ...rest }: SecondaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled]}
      {...rest}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
});
