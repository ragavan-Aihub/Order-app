import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PaymentMethodPicker, type PaymentChoice } from '@/components/PaymentMethodPicker';
import { UpiQrPanel } from '@/components/UpiQrPanel';
import { colors, radius, shadow, spacing } from '@/config/theme';
import { getBusinessUpiQrUrl, uploadBusinessUpiQrFromPickerAsset } from '@/services/business';
import { deliverOrderWithPayment, recordDeliveryPaymentOnly } from '@/services/orders';
import { formatPrice } from '@/utils/format';

type Props = {
  visible: boolean;
  businessId: string;
  orderId: string;
  amount: number;
  onClose: () => void;
  onDelivered: () => void;
  onRefreshOrder?: () => void | Promise<void>;
  /** Order already delivered (e.g. in admin) — only collect payment. */
  paymentOnly?: boolean;
};

export function DeliverPaymentModal({
  visible,
  businessId,
  orderId,
  amount,
  onClose,
  onDelivered,
  onRefreshOrder,
  paymentOnly = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const [payChoice, setPayChoice] = useState<PaymentChoice | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  const loadQr = useCallback(async () => {
    setLoadingQr(true);
    try {
      const url = await getBusinessUpiQrUrl(businessId);
      setQrUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load UPI QR.');
    } finally {
      setLoadingQr(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (!visible) {
      setPayChoice(null);
      setError(null);
      setConflict(null);
      return;
    }
    void loadQr();
  }, [visible, loadQr]);

  async function pickAndUpload() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Allow photo access to upload your UPI QR.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsEditing: true,
      aspect: [1, 1],
      base64: false,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset?.uri) {
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const url = await uploadBusinessUpiQrFromPickerAsset(businessId, asset);
      setQrUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload QR.');
    } finally {
      setUploading(false);
    }
  }

  async function confirmDeliver() {
    if (!payChoice) {
      setError('Choose how payment was collected.');
      return;
    }
    if (payChoice === 'upi' && !qrUrl) {
      setError('Add your UPI QR before marking UPI payment.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setConflict(null);
    const payment = payChoice === 'later' ? 'pending' : payChoice;
    const result = paymentOnly
      ? await recordDeliveryPaymentOnly(orderId, businessId, payment)
      : await deliverOrderWithPayment(orderId, businessId, payment);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      await onRefreshOrder?.();
      return;
    }
    if (result.outcome === 'already_applied' || result.outcome === 'updated_elsewhere') {
      setConflict(
        result.userMessage ??
          'This order was updated elsewhere. Close this screen and check the latest status.',
      );
      await onRefreshOrder?.();
      return;
    }
    onDelivered();
  }

  const canSubmit = payChoice !== null && !(payChoice === 'upi' && !qrUrl) && !submitting;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.backBtn} accessibilityRole="button" hitSlop={8}>
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>{paymentOnly ? 'Record payment' : 'Mark delivered'}</Text>
            <Text style={styles.subtitle}>
              {paymentOnly
                ? `Order already delivered · total ${formatPrice(amount)}`
                : `Total ${formatPrice(amount)} · payment collected?`}
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <PaymentMethodPicker value={payChoice} onChange={setPayChoice} />

          {payChoice === 'cash' ? (
            <View style={styles.infoCard}>
              <Ionicons name="cash-outline" size={28} color={colors.primary} />
              <Text style={styles.infoText}>Confirm you collected {formatPrice(amount)} in cash.</Text>
            </View>
          ) : null}

          {payChoice === 'upi' ? (
            loadingQr ? (
              <ActivityIndicator color={colors.primary} style={styles.loader} />
            ) : (
              <UpiQrPanel
                qrUrl={qrUrl}
                amount={amount}
                uploading={uploading}
                onPickImage={() => void pickAndUpload()}
                onLongPressReplace={() => void pickAndUpload()}
              />
            )
          ) : null}

          {payChoice === 'later' ? (
            <View style={[styles.infoCard, styles.infoCardLater]}>
              <Ionicons name="hourglass-outline" size={28} color={colors.warning} />
              <Text style={styles.infoText}>
                Order will show as outstanding until payment is recorded in admin.
              </Text>
            </View>
          ) : null}

          {conflict ? (
            <View style={styles.conflictCard}>
              <Ionicons name="sync-circle-outline" size={26} color={colors.primary} />
              <View style={styles.conflictTextWrap}>
                <Text style={styles.conflictTitle}>Order changed</Text>
                <Text style={styles.conflictBody}>{conflict}</Text>
              </View>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle-outline" size={22} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          {conflict ? (
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.confirmBtn, styles.conflictBtn, pressed && styles.btnPressed]}
              accessibilityRole="button"
            >
              <Text style={styles.confirmLabel}>Close and review order</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.cancelBtn, pressed && styles.btnPressed]}
                accessibilityRole="button"
              >
                <Text style={styles.cancelLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void confirmDeliver()}
                disabled={!canSubmit}
                style={({ pressed }) => [
                  styles.confirmBtn,
                  !canSubmit && styles.confirmDisabled,
                  pressed && canSubmit && styles.btnPressed,
                ]}
                accessibilityRole="button"
              >
                {submitting ? (
                  <ActivityIndicator color={colors.surface} />
                ) : (
                  <>
                    <Text style={styles.confirmLabel}>{paymentOnly ? 'Save payment' : 'Mark delivered'}</Text>
                    <Ionicons name="checkmark-circle" size={22} color={colors.surface} />
                  </>
                )}
              </Pressable>
            </>
          )}
        </View>
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
    gap: spacing.md,
  },
  infoCard: {
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
  infoCardLater: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
  },
  infoText: {
    flex: 1,
    color: colors.text,
    lineHeight: 21,
    fontSize: 15,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  cancelBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cancelLabel: {
    fontWeight: '700',
    color: colors.text,
    fontSize: 16,
  },
  confirmBtn: {
    flex: 1.35,
    flexDirection: 'row',
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.md,
    backgroundColor: colors.success,
    ...shadow.sm,
  },
  confirmDisabled: {
    opacity: 0.45,
  },
  btnPressed: {
    opacity: 0.9,
  },
  confirmLabel: {
    fontWeight: '800',
    color: colors.surface,
    fontSize: 16,
  },
  conflictCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  conflictTextWrap: {
    flex: 1,
    gap: 4,
  },
  conflictTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  conflictBody: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: '#FEF2F2',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 15,
    lineHeight: 21,
  },
  conflictBtn: {
    flex: 1,
  },
  loader: {
    marginVertical: spacing.lg,
  },
});
