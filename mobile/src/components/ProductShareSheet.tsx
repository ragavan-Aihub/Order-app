import { Ionicons } from '@expo/vector-icons';
import { useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductImage } from '@/components/ProductImage';
import { showAppDialog } from '@/components/AppDialogHost';
import { colors, radius, shadow, spacing } from '@/config/theme';
import {
  getShareBaseUrl,
  productShareUrl,
  shareProductViaSystem,
  shareProductViaWhatsApp,
} from '@/services/product-share';
import { hapticTap } from '@/utils/haptics';

/** Prefer system share — expo-clipboard needs a native rebuild not in current APKs. */
async function copyShareUrl(url: string) {
  await Share.share({ message: url });
}

type Props = {
  visible: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  imageUrl: string | null;
  description?: string | null;
};

export function ProductShareSheet({
  visible,
  onClose,
  productId,
  productName,
  imageUrl,
  description,
}: Props) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState<'copy' | 'whatsapp' | 'more' | null>(null);
  const blurb = (description?.trim() || 'Fresh from Farm2Flavour').slice(0, 90);

  async function withShareUrl(action: (url: string) => Promise<void>, kind: typeof busy) {
    const url = productShareUrl(productId);
    if (!url) {
      showAppDialog({
        title: 'Share link not configured',
        message: 'Set EXPO_PUBLIC_SHARE_BASE_URL to your admin Vercel URL (no trailing slash).',
        icon: 'link',
        tone: 'warning',
      });
      return;
    }
    setBusy(kind);
    try {
      await action(url);
    } catch {
      showAppDialog({
        title: 'Could not share',
        message: 'Try again in a moment.',
        icon: 'cloud-offline',
        tone: 'warning',
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <View style={styles.handleRow}>
            <Pressable
              onPress={onClose}
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
            <Text style={styles.title}>Share</Text>
            <View style={styles.closeSpacer} />
          </View>

          <View style={styles.preview}>
            <ProductImage uri={imageUrl} compact style={styles.thumb} recyclingKey={productId} />
            <View style={styles.previewCopy}>
              <Text style={styles.previewName} numberOfLines={2}>
                {productName}
              </Text>
              <Text style={styles.previewBlurb} numberOfLines={2}>
                {blurb}
              </Text>
            </View>
          </View>

          {!getShareBaseUrl() ? (
            <Text style={styles.configHint}>
              Add EXPO_PUBLIC_SHARE_BASE_URL (admin Vercel origin) to enable sharing.
            </Text>
          ) : null}

          <View style={styles.actions}>
            <ShareAction
              label="Share Link"
              color="#2563EB"
              icon="link"
              busy={busy === 'copy'}
              disabled={Boolean(busy)}
              onPress={() => {
                hapticTap();
                void withShareUrl(async (url) => {
                  await copyShareUrl(url);
                  onClose();
                }, 'copy');
              }}
            />
            <ShareAction
              label="WhatsApp"
              color="#16A34A"
              icon="logo-whatsapp"
              busy={busy === 'whatsapp'}
              disabled={Boolean(busy)}
              onPress={() => {
                hapticTap();
                void withShareUrl(async (url) => {
                  await shareProductViaWhatsApp(productName, url);
                  onClose();
                }, 'whatsapp');
              }}
            />
            <ShareAction
              label="More"
              color="#A8A29E"
              icon="ellipsis-horizontal"
              busy={busy === 'more'}
              disabled={Boolean(busy)}
              onPress={() => {
                hapticTap();
                void withShareUrl(async (url) => {
                  await shareProductViaSystem(productName, url);
                  onClose();
                }, 'more');
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ShareAction({
  label,
  icon,
  color,
  busy,
  disabled,
  onPress,
}: {
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  color: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.action, pressed && !disabled && styles.actionPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled }}
    >
      <View style={[styles.actionIcon, { backgroundColor: color }]}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Ionicons name={icon} size={22} color="#fff" />
        )}
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(24, 24, 27, 0.45)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    ...shadow.md,
  },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  close: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeSpacer: {
    width: 40,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  previewCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  previewName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  previewBlurb: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
    fontWeight: '500',
  },
  configHint: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.warning,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.sm,
    paddingBottom: spacing.md,
  },
  action: {
    width: 88,
    alignItems: 'center',
    gap: 8,
  },
  actionPressed: {
    opacity: 0.85,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
});
