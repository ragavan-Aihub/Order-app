import { useCallback, useRef } from 'react';
import { Animated } from 'react-native';

export function useSamSpeech(_input: { paused: boolean; onCommand: (text: string) => void }) {
  const volume = useRef(new Animated.Value(0)).current;
  const stopAll = useCallback(() => {}, []);

  return {
    available: false,
    listening: false,
    partial: '',
    volume,
    denied: false,
    error: null as string | null,
    startListening: useCallback(async () => {}, []),
    finishListening: stopAll,
    cancelListening: stopAll,
    stopAll,
  };
}
