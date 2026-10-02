import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/config/theme';

type QuantityStepperProps = {
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
  compact?: boolean;
};

export function QuantityStepper({ value, onDecrease, onIncrease, compact = false }: QuantityStepperProps) {
  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      <Pressable
        onPress={onDecrease}
        style={[styles.button, compact && styles.buttonCompact]}
        accessibilityRole="button"
      >
        <Text style={[styles.buttonLabel, compact && styles.buttonLabelCompact]}>−</Text>
      </Pressable>
      <Text style={[styles.value, compact && styles.valueCompact]}>{value}</Text>
      <Pressable
        onPress={onIncrease}
        style={[styles.button, compact && styles.buttonCompact]}
        accessibilityRole="button"
      >
        <Text style={[styles.buttonLabel, compact && styles.buttonLabelCompact]}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowCompact: {
    gap: 0,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    overflow: 'hidden',
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCompact: {
    width: 28,
    height: 28,
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: colors.primarySoft,
  },
  buttonLabel: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  buttonLabelCompact: {
    fontSize: 16,
    color: colors.primaryDark,
  },
  value: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  valueCompact: {
    minWidth: 22,
    fontSize: 13,
    color: colors.primaryDark,
  },
});
