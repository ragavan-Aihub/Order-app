import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

type SpeechLib = typeof import('expo-speech-recognition');

function isExpoGo() {
  return Constants.appOwnership === 'expo';
}

function getSpeechLib(): SpeechLib | null {
  if (isExpoGo()) {
    return null;
  }
  try {
    if (!requireOptionalNativeModule('ExpoSpeechRecognition')) {
      return null;
    }
    return require('expo-speech-recognition') as SpeechLib;
  } catch {
    return null;
  }
}

export function isHeySam(transcript: string) {
  return /^\s*(hey\s+sam|ஹே\s*சாம்)\s*[.!?]*\s*$/i.test(transcript.trim());
}

export function useSamSpeech(enabled: boolean, onFinal: (text: string) => void) {
  const [available] = useState(() => Boolean(getSpeechLib()));
  const [listening, setListening] = useState(false);
  const [denied, setDenied] = useState(!available);
  const [error, setError] = useState<string | null>(
    available ? null : 'Having trouble hearing you? You can type your request instead.',
  );
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => {
    const lib = getSpeechLib();
    if (!lib) {
      return;
    }
    const resultSub = lib.ExpoSpeechRecognitionModule.addListener(
      'result',
      (event: { isFinal?: boolean; results?: Array<{ transcript?: string }> }) => {
        const text = event.results?.[0]?.transcript?.trim();
        if (!text || !event.isFinal) {
          return;
        }
        onFinalRef.current(text);
      },
    );
    const errorSub = lib.ExpoSpeechRecognitionModule.addListener('error', () => {
      setError('Having trouble hearing you? You can type your request instead.');
      setListening(false);
    });
    return () => {
      resultSub.remove();
      errorSub.remove();
    };
  }, []);

  const stop = useCallback(() => {
    try {
      getSpeechLib()?.ExpoSpeechRecognitionModule.stop();
    } catch {
      // Expo Go has no native recognizer.
    }
    setListening(false);
  }, []);

  const start = useCallback(async () => {
    const lib = getSpeechLib();
    if (!enabled || !lib) {
      return;
    }
    setError(null);
    try {
      const permission = await lib.ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setDenied(true);
        setListening(false);
        return;
      }
      setDenied(false);
      lib.ExpoSpeechRecognitionModule.start({
        lang: 'en-IN',
        interimResults: false,
        continuous: true,
        androidIntentOptions: {
          EXTRA_ENABLE_LANGUAGE_DETECTION: true,
          EXTRA_LANGUAGE_DETECTION_ALLOWED_LANGUAGES: ['en-IN', 'ta-IN'],
        },
      });
      setListening(true);
    } catch {
      setDenied(true);
      setError('Having trouble hearing you? You can type your request instead.');
      setListening(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !available) {
      stop();
      return;
    }
    start().catch(() => undefined);
    const onChange = (state: AppStateStatus) => {
      if (state !== 'active') {
        stop();
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => {
      sub.remove();
      stop();
    };
  }, [available, enabled, start, stop]);

  return { listening, denied, error, start, stop, setError };
}
