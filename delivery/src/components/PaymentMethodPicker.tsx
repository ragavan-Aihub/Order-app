import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/config/theme';

export type PaymentChoice = 'cash' | 'upi' | 'later';

const OPTIONS: {
  value: PaymentChoice;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'cash', label: 'Cash', icon: 'cash-outline' },
  { value: 'upi', label: 'UPI', icon: 'phone-portrait-outline' },
  { value: 'later', label: 'Not yet', icon: 'hourglass-outline' },
];

export function PaymentMethodPicker({
  value,
  onChange,
}: {
  value: PaymentChoice | null;
  onChange: (value: PaymentChoice) => void;
}) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Payment method">
      {OPTIONS.map((option) => {
        const selected = value === option.value;
        const later = option.value === 'later';
        const upi = option.value === 'upi';
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.chip,
              selected && (later ? styles.chipLater : upi ? styles.chipUpi : styles.chipSelected),
              pressed && styles.chipPressed,
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
          >
            {selected ? (
              <View style={[styles.checkBadge, later && styles.checkBadgeLater]}>
                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
              </View>
            ) : null}
            <Ionicons
              name={option.icon}
              size={22}
              color={selected ? (later ? colors.warning : colors.primaryDark) : colors.textMuted}
            />
            <Text
              style={[
                styles.chipLabel,
                selected && (later ? styles.chipLabelLater : styles.chipLabelSelected),
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    flex: 1,
    minHeight: 72,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    paddingTop: 8,
    gap: 4,
    position: 'relative',
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipUpi: {
    borderColor: colors.primary,
    backgroundColor: '#ECFDF5',
  },
  chipLater: {
    borderColor: '#FDBA74',
    backgroundColor: '#FFF7ED',
  },
  chipPressed: {
    opacity: 0.92,
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadgeLater: {
    backgroundColor: colors.warning,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
  },
  chipLabelSelected: {
    color: colors.primaryDark,
  },
  chipLabelLater: {
    color: colors.warning,
  },
});
