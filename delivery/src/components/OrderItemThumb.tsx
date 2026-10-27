import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/config/theme';

type Props = {
  name: string;
  imageUrl: string | null | undefined;
  quantity: number;
  size?: number;
};

export function OrderItemThumb({ name, imageUrl, quantity, size = 44 }: Props) {
  const letter = name.trim().charAt(0).toUpperCase() || '?';
  const radius = size / 2;

  return (
    <View style={{ width: size, height: size }}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={[styles.image, { width: size, height: size, borderRadius: radius }]}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={[styles.fallback, { width: size, height: size, borderRadius: radius }]}>
          <Text style={[styles.letter, { fontSize: size * 0.38 }]}>{letter}</Text>
        </View>
      )}
      <View style={styles.qtyBadge}>
        <Text style={styles.qtyText}>{quantity}×</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  fallback: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#99F6E4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontWeight: '800',
    color: colors.primaryDark,
  },
  qtyBadge: {
    position: 'absolute',
    right: -6,
    bottom: -4,
    backgroundColor: colors.primaryDark,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  qtyText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
});
