import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { colors } from '@/config/theme';
import { hapticTap } from '@/utils/haptics';

export function FavoriteHeart({
  on,
  onPress,
  size = 'card',
}: {
  on: boolean;
  onPress: () => void;
  size?: 'card' | 'compact' | 'header';
}) {
  const large = size === 'header';
  const tiny = size === 'compact';
  return (
    <Pressable
      onPress={() => {
        hapticTap();
        onPress();
      }}
      hitSlop={8}
      style={({ pressed }) => [
        large ? styles.header : tiny ? styles.compact : styles.card,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={on ? 'Remove from favourites' : 'Save as favourite'}
      accessibilityState={{ selected: on }}
    >
      <Ionicons
        name={on ? 'heart' : 'heart-outline'}
        size={large ? 24 : tiny ? 14 : 18}
        color={on ? '#DC2626' : large ? colors.text : colors.primaryDark}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
});
