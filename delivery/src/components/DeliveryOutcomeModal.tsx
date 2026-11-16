import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadow, spacing } from '@/config/theme';
import {
  NOT_DELIVERED_REASONS,
  reasonByCode,
  type DeliveryNextAction,
} from '@/lib/delivery-outcome';
import { recordNotDelivered } from '@/services/orders';

type Step = 'outcome' | 'reason';

type Props = {
  visible: boolean;
  businessId: string;
  orderId: string;
  onClose: () => void;
  onDeliveredChosen: () => void;
  onFinished: (result: { cancelled: boolean; message?: string }) => void;
};

export function DeliveryOutcomeModal({
  visible,
  businessId,
  orderId,
  onClose,
  onDeliveredChosen,
  onFinished,
}: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('outcome');
  const [code, setCode] = useState<string | null>(null);
  const [otherText, setOtherText] = useState('');
  const [otherAction, setOtherAction] = useState<'reschedule' | 'cancel'>('reschedule');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      return;
    }
    setStep('outcome');
    setCode(null);
    setOtherText('');
    setOtherAction('reschedule');
    setSubmitting(false);
    setError(null);
  }, [visible]);

  const selected = code ? reasonByCode(code) : undefined;
  const nextAction: Exclude<DeliveryNextAction, 'choose'> | null = selected
    ? selected.action === 'choose'
      ? otherAction
      : selected.action === 'complete'
        ? 'complete'
        : selected.action
    : null;

  async function submitNotDelivered() {
    if (!selected || !nextAction || nextAction === 'complete') {
      setError('Choose why this could not be delivered.');
      return;
    }
    const reasonText = selected.code === 'other' ? otherText.trim() : selected.label;
    if (selected.code === 'other' && reasonText.length < 3) {
      setError('Type a short reason.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await recordNotDelivered(orderId, businessId, {
      reasonCode: selected.code,
      reasonText,
      nextAction,
    });
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.outcome === 'updated_elsewhere') {
      setError(result.userMessage ?? 'This order was updated elsewhere.');
      return;
    }
    onFinished({
      cancelled: nextAction === 'cancel',
      message: result.userMessage,
    });
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable
            onPress={step === 'reason' ? () => setStep('outcome') : onClose}
            style={styles.backBtn}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>
              {step === 'outcome' ? 'How did this delivery go?' : 'Why was it not delivered?'}
            </Text>
            <Text style={styles.subtitle}>
              {step === 'outcome'
                ? 'Choose the result at the door. Payment is only for delivered orders.'
                : 'Pick a reason. Try again keeps the order out for delivery; cancel closes it.'}
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 'outcome' ? (
            <>
              <Pressable
                onPress={onDeliveredChosen}
                style={({ pressed }) => [styles.choice, styles.choiceDelivered, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Ionicons name="checkmark-circle" size={28} color={colors.success} />
                <View style={styles.choiceCopy}>
                  <Text style={styles.choiceTitle}>Delivered</Text>
                  <Text style={styles.choiceBody}>Handed to the customer. Next, collect payment.</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Pressable>
              <Pressable
                onPress={() => setStep('reason')}
                style={({ pressed }) => [styles.choice, styles.choiceMissed, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Ionicons name="close-circle" size={28} color={colors.warning} />
                <View style={styles.choiceCopy}>
                  <Text style={styles.choiceTitle}>Not delivered</Text>
                  <Text style={styles.choiceBody}>Home locked, refused, or another issue.</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Pressable>
            </>
          ) : (
            <>
              {NOT_DELIVERED_REASONS.map((reason) => {
                const on = code === reason.code;
                return (
                  <Pressable
                    key={reason.code}
                    onPress={() => setCode(reason.code)}
                    style={({ pressed }) => [styles.reason, on && styles.reasonOn, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.reasonLabel, on && styles.reasonLabelOn]}>{reason.label}</Text>
                    {reason.action !== 'choose' ? (
                      <Text style={[styles.reasonHint, on && styles.reasonHintOn]}>
                        {reason.action === 'reschedule' ? 'Try again' : 'Cancel order'}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
              {selected?.code === 'other' ? (
                <>
                  <TextInput
                    value={otherText}
                    onChangeText={setOtherText}
                    placeholder="Type the reason"
                    placeholderTextColor={colors.textMuted}
                    multiline
                    style={styles.input}
                  />
                  <View style={styles.otherRow}>
                    <Pressable
                      onPress={() => setOtherAction('reschedule')}
                      style={[styles.mini, otherAction === 'reschedule' && styles.miniOn]}
                    >
                      <Text style={[styles.miniLabel, otherAction === 'reschedule' && styles.miniLabelOn]}>
                        Try again
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setOtherAction('cancel')}
                      style={[styles.mini, otherAction === 'cancel' && styles.miniDanger]}
                    >
                      <Text style={[styles.miniLabel, otherAction === 'cancel' && styles.miniLabelOn]}>
                        Cancel order
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : null}
            </>
          )}

          {error ? (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle-outline" size={22} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>

        {step === 'reason' ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <Pressable
              onPress={() => void submitNotDelivered()}
              disabled={!selected || submitting}
              style={({ pressed }) => [
                styles.submit,
                nextAction === 'cancel' && styles.submitDanger,
                (!selected || submitting) && styles.submitDisabled,
                pressed && selected && styles.pressed,
              ]}
              accessibilityRole="button"
            >
              {submitting ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.submitLabel}>
                  {nextAction === 'cancel' ? 'Cancel order' : 'Save and try again'}
                </Text>
              )}
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  backBtn: {
    padding: 4,
    marginTop: 2,
  },
  headerText: {
    flex: 1,
    paddingRight: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 20,
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  choiceDelivered: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  choiceMissed: {
    borderColor: '#FDBA74',
    backgroundColor: '#FFF7ED',
  },
  choiceCopy: {
    flex: 1,
  },
  choiceTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  choiceBody: {
    marginTop: 2,
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 19,
  },
  reason: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  reasonOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  reasonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  reasonLabelOn: {
    color: colors.primaryDark,
  },
  reasonHint: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textMuted,
  },
  reasonHintOn: {
    color: colors.primaryDark,
  },
  input: {
    minHeight: 88,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    fontSize: 16,
    color: colors.text,
    textAlignVertical: 'top',
  },
  otherRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  mini: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  miniOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  miniDanger: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  miniLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  miniLabelOn: {
    color: colors.primaryDark,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#FEF2F2',
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 14,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  submit: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  submitDanger: {
    backgroundColor: colors.danger,
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitLabel: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.9,
  },
});
