import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { QrScanFrame } from '@/components/QrScanFrame';
import { colors, radius, shadow, spacing } from '@/config/theme';
import { formatPrice } from '@/utils/format';

type Props = {
  qrUrl: string | null;
  amount: number;
  uploading: boolean;
  onPickImage: () => void;
  onLongPressReplace: () => void;
};

export function UpiQrPanel({ qrUrl, amount, uploading, onPickImage, onLongPressReplace }: Props) {
  if (!qrUrl) {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.amountLabel}>Amount: {formatPrice(amount)}</Text>
        </View>
        <View style={styles.emptyBody}>
          <Ionicons name="qr-code-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Add your shop UPI QR</Text>
          <Text style={styles.emptyHint}>Pick and crop a square QR image for this shop.</Text>
          <Pressable
            onPress={onPickImage}
            disabled={uploading}
            style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
            accessibilityRole="button"
          >
            {uploading ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={styles.addButtonLabel}>Choose QR image</Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.amountLabel}>Amount: {formatPrice(amount)}</Text>
      </View>

      <Pressable
        onLongPress={() => {
          Alert.alert('Replace UPI QR?', 'Choose a new QR image from your gallery.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Replace', onPress: onLongPressReplace },
          ]);
        }}
        delayLongPress={400}
        accessibilityRole="image"
        accessibilityHint="Long press to replace the QR image"
      >
        <QrScanFrame style={styles.scanArea}>
          <Image source={{ uri: qrUrl }} style={styles.qrImage} contentFit="contain" transition={200} />
          {uploading ? (
            <View style={styles.uploadOverlay}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : null}
        </QrScanFrame>
      </Pressable>

      <View style={styles.cardFooter}>
        <Text style={styles.footerTitle}>Show this QR to the customer.</Text>
        <View style={styles.footerHintRow}>
          <Ionicons name="crop-outline" size={14} color={colors.textMuted} />
          <Text style={styles.footerHint}>Long press to crop and replace.</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.sm,
  },
  cardHeader: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  amountLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  scanArea: {
    minHeight: 240,
    paddingVertical: spacing.md,
  },
  qrImage: {
    width: 200,
    height: 200,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFooter: {
    backgroundColor: '#F5F5F4',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 4,
  },
  footerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  footerHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  footerHint: {
    fontSize: 12,
    fontStyle: 'italic',
    color: colors.textMuted,
  },
  emptyBody: {
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  emptyHint: {
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  addButtonPressed: {
    backgroundColor: colors.primaryDark,
  },
  addButtonLabel: {
    color: colors.surface,
    fontWeight: '700',
    fontSize: 15,
  },
});
