import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/config/theme';

const PLACEHOLDER_BG = '#E4E4E7';

export function isValidProductImageUri(uri: string | null | undefined): boolean {
  const trimmed = uri?.trim();
  if (!trimmed) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

type ProductImageProps = {
  uri: string | null | undefined;
  style?: StyleProp<ViewStyle>;
  dimmed?: boolean;
  recyclingKey?: string;
  /** Smaller icon and label for cart / list thumbnails. */
  compact?: boolean;
  accessibilityLabel?: string;
};

export function ProductImage({
  uri,
  style,
  dimmed = false,
  recyclingKey,
  compact = false,
  accessibilityLabel,
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);
  const validUri = isValidProductImageUri(uri) ? uri!.trim() : null;

  useEffect(() => {
    setFailed(false);
  }, [validUri]);

  const showPlaceholder = !validUri || failed;

  if (showPlaceholder) {
    return (
      <View
        style={[styles.placeholder, compact && styles.placeholderCompact, style, dimmed && styles.dimmed]}
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel ?? 'No product image'}
      >
        <Ionicons
          name="image-outline"
          size={compact ? 20 : 28}
          color={colors.textMuted}
          style={styles.icon}
        />
        <Text style={[styles.label, compact && styles.labelCompact]} numberOfLines={1}>
          No Image
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.frame, style, dimmed && styles.dimmed]}>
      <Image
        source={{ uri: validUri }}
        style={styles.image}
        contentFit="cover"
        contentPosition="center"
        transition={180}
        cachePolicy="memory-disk"
        recyclingKey={recyclingKey}
        accessibilityIgnoresInvertColors
        accessibilityLabel={accessibilityLabel}
        onError={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    backgroundColor: PLACEHOLDER_BG,
  },
  image: {
    ...StyleSheet.absoluteFill,
  },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: PLACEHOLDER_BG,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    gap: 4,
  },
  placeholderCompact: {
    gap: 2,
    paddingHorizontal: 4,
  },
  icon: {
    opacity: 0.85,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
  },
  labelCompact: {
    fontSize: 9,
    lineHeight: 11,
  },
  dimmed: {
    opacity: 0.4,
  },
});
