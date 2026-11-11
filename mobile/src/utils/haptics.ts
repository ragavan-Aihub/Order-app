/**
 * Click feel for shop taps. Android uses a vibration pattern (duration-only
 * pulses are often too short to notice). iOS uses the default Vibration pulse.
 */
import { Platform, Vibration } from 'react-native';

function buzz(kind: 'tap' | 'error') {
  try {
    if (Platform.OS === 'android') {
      Vibration.vibrate(kind === 'error' ? [0, 40, 40, 60] : [0, 80]);
      return;
    }
    Vibration.vibrate();
  } catch {
    // ignore: vibration is optional
  }
}

export function hapticSelect() {
  buzz('tap');
}

export function hapticTap() {
  buzz('tap');
}

export function hapticSuccess() {
  buzz('tap');
}

export function hapticError() {
  buzz('error');
}
