import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { colors } from '@/config/theme';

const CORNER = 22;
const STROKE = 3;
const PAD = 12;

function Corner({ style }: { style: ViewStyle }) {
  return <View style={[styles.corner, style]} />;
}

export function QrScanFrame({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.frame, style]}>
      {children}
      <Corner style={styles.topLeft} />
      <Corner style={styles.topRight} />
      <Corner style={styles.bottomLeft} />
      <Corner style={styles.bottomRight} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    padding: PAD,
    width: '100%',
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: colors.primary,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: STROKE,
    borderLeftWidth: STROKE,
    borderTopLeftRadius: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: STROKE,
    borderRightWidth: STROKE,
    borderTopRightRadius: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: STROKE,
    borderLeftWidth: STROKE,
    borderBottomLeftRadius: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: STROKE,
    borderRightWidth: STROKE,
    borderBottomRightRadius: 4,
  },
});
