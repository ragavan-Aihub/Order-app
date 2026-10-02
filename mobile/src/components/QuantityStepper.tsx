import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/config/theme';

type QuantityStepperProps = {
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
  compact?: boolean;
  stretch?: boolean;
};

export function QuantityStepper({
  value,
  onDecrease,
  onIncrease,
  compact = false,
  stretch = false,
}: QuantityStepperProps) {
  return (
    <View style={[styles.row, compact && styles.rowCompact, stretch && styles.rowStretch]}>
      <Pressable
        onPress={onDecrease}
        style={[styles.button, compact && styles.buttonCompact]}
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
      >
        <Text style={[styles.buttonLabel, compact && styles.buttonLabelCompact]}>−</Text>
      </Pressable>
      <Text style={[styles.value, compact && styles.valueCompact, stretch && styles.valueStretch]}>{value}</Text>
      <Pressable
        onPress={onIncrease}
        style={[styles.button, compact && styles.buttonCompact]}
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
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
    width: 30,
    height: 30,
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
    minWidth: 26,
    fontSize: 14,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  rowStretch: {
    alignSelf: 'stretch',
  },
  valueStretch: {
    flex: 1,
  },
});
