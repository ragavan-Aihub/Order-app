import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppDialog } from '@/components/AppDialog';
import { colors, radius, spacing } from '@/config/theme';

const PRESETS = [
  'Ordered by mistake',
  'Need different items',
  'Taking too long',
  'Changed my mind',
  'Not able to receive order',
  'Other',
] as const;

function buildReason(preset: string, other: string) {
  if (preset === 'Other') {
    const note = other.trim();
    return note.length >= 3 ? note.slice(0, 120) : '';
  }
  return preset;
}

export function CancelOrderDialog({
  visible,
  orderLabel,
  busy = false,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  orderLabel: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [preset, setPreset] = useState<string>(PRESETS[0]);
  const [other, setOther] = useState('');

  useEffect(() => {
    if (visible) {
      setPreset(PRESETS[0]);
      setOther('');
    }
  }, [visible]);

  const reason = buildReason(preset, other);

  return (
    <AppDialog
      visible={visible}
      title="Why are you cancelling?"
      message={`${orderLabel} will be cancelled. This cannot be undone.`}
      icon="close-circle"
      tone="danger"
      dismissible={!busy}
      onClose={() => {
        if (!busy) {
          onClose();
        }
      }}
      actions={[
        {
          label: busy ? 'Cancelling…' : 'Cancel order',
          variant: 'danger',
          busy,
          disabled: !reason,
          onPress: () => {
            if (!reason || busy) {
              return;
            }
            onConfirm(reason);
          },
        },
      ]}
    >
      <View style={styles.wrap}>
        <View style={styles.chips}>
          {PRESETS.map((item) => {
            const on = preset === item;
            return (
              <Pressable
                key={item}
                onPress={() => setPreset(item)}
                disabled={busy}
                style={[styles.chip, on && styles.chipOn]}
                accessibilityRole="button"
              >
                <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{item}</Text>
              </Pressable>
            );
          })}
        </View>
        {preset === 'Other' ? (
          <TextInput
            value={other}
            onChangeText={setOther}
            placeholder="Tell us briefly"
            placeholderTextColor={colors.textMuted}
            maxLength={120}
            editable={!busy}
            style={styles.input}
            accessibilityLabel="Cancellation reason"
          />
        ) : null}
      </View>
    </AppDialog>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: {
    borderColor: colors.danger,
    backgroundColor: '#FEF2F2',
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  chipLabelOn: {
    color: colors.danger,
  },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
  },
});
