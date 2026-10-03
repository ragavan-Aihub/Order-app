import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, PermissionsAndroid, Platform, type AppStateStatus } from 'react-native';

type SpeechLib = typeof import('expo-speech-recognition');

const FALLBACK = 'Having trouble hearing you? You can type your request instead.';
const MISSED = "I didn't catch that. Tap the mic and try again.";
const LANGS = ['en-IN', 'en-US', 'ta-IN'] as const;

function log(...args: unknown[]) {
  if (__DEV__) {
    console.log('[voice]', ...args);
  }
}

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

function messageForSpeechError(code?: string | null) {
  if (code === 'not-allowed') {
    return 'Allow Microphone for Farm2Flavour in Settings.';
  }
  if (code === 'service-not-allowed') {
    return 'Speech-to-text is off. In Settings set Speech recognition to Google, or update the Google app.';
  }
  if (code === 'network') {
    return 'Voice needs an internet connection. You can type your request instead.';
  }
  return FALLBACK;
}

async function requestAndroidMic() {
  if (Platform.OS !== 'android') {
    return true;
  }
  try {
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
      title: 'Microphone',
      message: 'Farm2Flavour needs the microphone to hear your order.',
      buttonPositive: 'Allow',
      buttonNegative: 'Not now',
    });
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export function useSamSpeech({ paused, onCommand }: { paused: boolean; onCommand: (text: string) => void }) {
  const [available, setAvailable] = useState(false);
  const [listening, setListening] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState('');
  const volume = useRef(new Animated.Value(0)).current;

  const onCommandRef = useRef(onCommand);
  const listeningRef = useRef(false);
  const pausedRef = useRef(paused);
  const permissionRef = useRef(false);
  const langIndexRef = useRef(0);
  // Android emits `end` for every abort(), even when nothing was running.
  const ignoredEndsRef = useRef(0);
  const startedAtRef = useRef(0);
  const lastErrorRef = useRef<string | null>(null);
  const heardRef = useRef('');
  const deliveredRef = useRef(false);
  onCommandRef.current = onCommand;
  pausedRef.current = paused;

  const setListeningBoth = useCallback((next: boolean) => {
    listeningRef.current = next;
    setListening(next);
  }, []);

  const abortSession = useCallback(() => {
    const lib = getSpeechLib();
    if (!lib) {
      return;
    }
    try {
      lib.ExpoSpeechRecognitionModule.abort();
      ignoredEndsRef.current += 1;
    } catch {
      // Nothing to abort.
    }
  }, []);

  const ensurePermission = useCallback(async () => {
    const lib = getSpeechLib();
    if (!lib) {
      return false;
    }
    if (permissionRef.current) {
      return true;
    }
    if (!(await requestAndroidMic())) {
      setDenied(true);
      setError(messageForSpeechError('not-allowed'));
      return false;
    }
    const permission = await lib.ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync();
    if (!permission.granted) {
      const both = await lib.ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!both.granted) {
        setDenied(true);
        setError(messageForSpeechError('not-allowed'));
        return false;
      }
    }
    if (
      typeof lib.ExpoSpeechRecognitionModule.isRecognitionAvailable === 'function' &&
      !lib.ExpoSpeechRecognitionModule.isRecognitionAvailable()
    ) {
      setError(messageForSpeechError('service-not-allowed'));
      return false;
    }
    setDenied(false);
    permissionRef.current = true;
    return true;
  }, []);

  const startSession = useCallback(() => {
    const lib = getSpeechLib();
    if (!lib) {
      return;
    }
    heardRef.current = '';
    deliveredRef.current = false;
    lastErrorRef.current = null;
    startedAtRef.current = Date.now();
    setPartial('');
    volume.setValue(0);
    setListeningBoth(true);
    log('start', LANGS[langIndexRef.current]);
    lib.ExpoSpeechRecognitionModule.start({
      lang: LANGS[langIndexRef.current],
      interimResults: true,
      continuous: false,
      volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
    });
  }, [setListeningBoth, volume]);

  const deliver = useCallback(
    (text: string) => {
      const value = text.trim();
      if (!value) {
        return;
      }
      deliveredRef.current = true;
      langIndexRef.current = 0;
      setListeningBoth(false);
      setPartial('');
      setError(null);
      volume.setValue(0);
      log('command', JSON.stringify(value));
      onCommandRef.current(value);
    },
    [setListeningBoth, volume],
  );

  useEffect(() => {
    setAvailable(Boolean(getSpeechLib()));
    if (isExpoGo()) {
      setError('Voice works in the installed Farm2Flavour app, not in Expo Go. You can type instead.');
    }
  }, []);

  useEffect(() => {
    const lib = getSpeechLib();
    if (!lib) {
      return;
    }
    const resultSub = lib.ExpoSpeechRecognitionModule.addListener(
      'result',
      (event: { isFinal?: boolean; results?: { transcript?: string }[] }) => {
        const text = event.results?.[0]?.transcript?.trim();
        log('result', event.isFinal ? 'final' : 'interim', JSON.stringify(text ?? ''));
        if (!text || deliveredRef.current) {
          return;
        }
        heardRef.current = text;
        setPartial(text);
        if (event.isFinal !== false) {
          deliver(text);
        }
      },
    );
    const volumeSub = lib.ExpoSpeechRecognitionModule.addListener('volumechange', (event: { value?: number }) => {
      const level = Math.min(1, Math.max(0, ((event.value ?? -2) + 2) / 12));
      Animated.timing(volume, { toValue: level, duration: 120, useNativeDriver: true }).start();
    });
    const errorSub = lib.ExpoSpeechRecognitionModule.addListener(
      'error',
      (event: { error?: string; message?: string }) => {
        const code = event.error ?? 'unknown';
        log('error', code, event.message ?? '');
        lastErrorRef.current = code;
        if (code === 'not-allowed') {
          permissionRef.current = false;
          setDenied(true);
          setError(messageForSpeechError(code));
        } else if (code === 'service-not-allowed') {
          setError(messageForSpeechError(code));
        } else if (code === 'language-not-supported') {
          langIndexRef.current = Math.min(langIndexRef.current + 1, LANGS.length - 1);
        }
      },
    );
    const endSub = lib.ExpoSpeechRecognitionModule.addListener('end', () => {
      if (ignoredEndsRef.current > 0) {
        ignoredEndsRef.current -= 1;
        log('end (ignored)');
        return;
      }
      const code = lastErrorRef.current;
      const pending = heardRef.current.trim();
      log('end', code ?? 'ok', `${Date.now() - startedAtRef.current}ms`);
      heardRef.current = '';
      lastErrorRef.current = null;

      if (deliveredRef.current) {
        return;
      }
      if (pending) {
        deliver(pending);
        return;
      }
      setListeningBoth(false);
      setPartial('');
      volume.setValue(0);
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        return;
      }
      if (code === 'language-not-supported' && !pausedRef.current) {
        startSession();
        return;
      }
      setError(code === 'network' ? messageForSpeechError(code) : MISSED);
    });
    return () => {
      resultSub.remove();
      volumeSub.remove();
      errorSub.remove();
      endSub.remove();
    };
  }, [deliver, setListeningBoth, startSession, volume]);

  const stopAll = useCallback(() => {
    if (listeningRef.current) {
      abortSession();
    }
    setListeningBoth(false);
    setPartial('');
    volume.setValue(0);
  }, [abortSession, setListeningBoth, volume]);

  const startListening = useCallback(async () => {
    if (!available) {
      setError(FALLBACK);
      return;
    }
    if (listeningRef.current || !(await ensurePermission())) {
      return;
    }
    setError(null);
    startSession();
  }, [available, ensurePermission, startSession]);

  const finishListening = useCallback(() => {
    const lib = getSpeechLib();
    if (!listeningRef.current || !lib) {
      return;
    }
    const pending = heardRef.current.trim();
    if (pending) {
      abortSession();
      deliver(pending);
      return;
    }
    try {
      lib.ExpoSpeechRecognitionModule.stop();
    } catch {
      stopAll();
    }
  }, [abortSession, deliver, stopAll]);

  useEffect(() => {
    if (paused) {
      stopAll();
    }
  }, [paused, stopAll]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') {
        stopAll();
      }
    });
    return () => {
      sub.remove();
    };
  }, [stopAll]);

  useEffect(() => () => stopAll(), [stopAll]);

  return {
    available,
    listening,
    partial,
    volume,
    denied,
    error,
    startListening,
    finishListening,
    cancelListening: stopAll,
    stopAll,
  };
}
