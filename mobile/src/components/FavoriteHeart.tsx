import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { colors } from '@/config/theme';
import { hapticTap } from '@/utils/haptics';

export function FavoriteHeart({
  on,
  onPress,
  busy = false,
  size = 'card',
}: {
  on: boolean;
  onPress: () => void;
  busy?: boolean;
  size?: 'card' | 'compact' | 'header';
}) {
  const large = size === 'header';
  const tiny = size === 'compact';
  const iconSize = large ? 24 : tiny ? 14 : 18;
  return (
    <Pressable
      onPress={() => {
        if (busy) {
          return;
        }
        hapticTap();
        onPress();
      }}
      disabled={busy}
      hitSlop={8}
      style={({ pressed }) => [
        large ? styles.header : tiny ? styles.compact : styles.card,
        pressed && !busy && styles.pressed,
        busy && styles.busy,
      ]}
      accessibilityRole="button"
      accessibilityLabel={on ? 'Remove from favourites' : 'Save as favourite'}
      accessibilityState={{ selected: on, busy }}
    >
      {busy ? (
        <ActivityIndicator size="small" color={on ? '#DC2626' : colors.primaryDark} />
      ) : (
        <Ionicons
          name={on ? 'heart' : 'heart-outline'}
          size={iconSize}
          color={on ? '#DC2626' : large ? colors.text : colors.primaryDark}
        />
      )}
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
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  busy: {
    opacity: 0.85,
  },
});
