import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, PermissionsAndroid, Platform, type AppStateStatus } from 'react-native';

type SpeechLib = typeof import('expo-speech-recognition');

const FALLBACK =
  'Having trouble hearing you? You can type your request instead.';
const LANGS = ['en-IN', 'en-US', 'ta-IN'] as const;

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

function supportsContinuousAndroid() {
  return Platform.OS !== 'android' || Number(Platform.Version) >= 33;
}

function messageForSpeechError(code?: string) {
  if (code === 'not-allowed') {
    return 'Allow Microphone for Farm2Flavour in Settings (YouTube permission is separate).';
  }
  if (code === 'service-not-allowed') {
    return 'The mic works, but speech-to-text is off. In Settings set Speech recognition to Google, or install/update the Google app.';
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
      message: 'Sam needs the microphone to hear your order.',
      buttonPositive: 'Allow',
      buttonNegative: 'Not now',
    });
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export function isHeySam(transcript: string) {
  const text = transcript.trim();
  return /^(hey\s+)?sam[.!?]*$/i.test(text) || /^(ஹே\s*)?சாம்[.!?]*$/.test(text);
}

export function useSamSpeech(enabled: boolean, onFinal: (text: string) => void) {
  const [available, setAvailable] = useState(false);
  const [listening, setListening] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onFinalRef = useRef(onFinal);
  const enabledRef = useRef(enabled);
  const langIndexRef = useRef(0);
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHeardRef = useRef('');
  const deliveredRef = useRef(false);
  const startRef = useRef<() => Promise<void>>(async () => undefined);
  onFinalRef.current = onFinal;
  enabledRef.current = enabled;

  const clearRestart = useCallback(() => {
    if (restartTimer.current) {
      clearTimeout(restartTimer.current);
      restartTimer.current = null;
    }
  }, []);

  const scheduleRestart = useCallback(() => {
    clearRestart();
    restartTimer.current = setTimeout(() => {
      if (enabledRef.current && AppState.currentState === 'active') {
        startRef.current().catch(() => undefined);
      }
    }, 400);
  }, [clearRestart]);

  useEffect(() => {
    const ok = Boolean(getSpeechLib());
    setAvailable(ok);
    if (!ok) {
      setError(
        isExpoGo()
          ? 'Voice works in the installed Farm2Flavour app, not in Expo Go. You can type instead.'
          : FALLBACK,
      );
    }
  }, []);

  useEffect(() => {
    const lib = getSpeechLib();
    if (!lib) {
      return;
    }
    const resultSub = lib.ExpoSpeechRecognitionModule.addListener(
      'result',
      (event: { isFinal?: boolean; results?: Array<{ transcript?: string }> }) => {
        const text = event.results?.[0]?.transcript?.trim();
        if (!text) {
          return;
        }
        lastHeardRef.current = text;
        if (event.isFinal === false) {
          return;
        }
        langIndexRef.current = 0;
        deliveredRef.current = true;
        lastHeardRef.current = '';
        onFinalRef.current(text);
      },
    );
    const endSub = lib.ExpoSpeechRecognitionModule.addListener('end', () => {
      setListening(false);
      const pending = lastHeardRef.current.trim();
      if (pending && !deliveredRef.current) {
        deliveredRef.current = true;
        lastHeardRef.current = '';
        langIndexRef.current = 0;
        onFinalRef.current(pending);
        return;
      }
      if (deliveredRef.current) {
        deliveredRef.current = false;
        return;
      }
      if (enabledRef.current) {
        scheduleRestart();
      }
    });
    const errorSub = lib.ExpoSpeechRecognitionModule.addListener(
      'error',
      (event: { error?: string }) => {
        setListening(false);
        const code = event.error;
        if (code === 'not-allowed') {
          setDenied(true);
          setError(messageForSpeechError(code));
          return;
        }
        if (code === 'language-not-supported') {
          langIndexRef.current = Math.min(langIndexRef.current + 1, LANGS.length - 1);
          if (enabledRef.current) {
            scheduleRestart();
          }
          return;
        }
        if (code === 'no-speech' || code === 'speech-timeout' || code === 'aborted') {
          if (enabledRef.current) {
            scheduleRestart();
          }
          return;
        }
        setError(messageForSpeechError(code));
        if (code !== 'service-not-allowed' && enabledRef.current) {
          scheduleRestart();
        }
      },
    );
    return () => {
      resultSub.remove();
      endSub.remove();
      errorSub.remove();
    };
  }, [scheduleRestart]);

  const stop = useCallback(() => {
    clearRestart();
    try {
      getSpeechLib()?.ExpoSpeechRecognitionModule.abort();
    } catch {
      // Expo Go has no native recognizer.
    }
    setListening(false);
  }, [clearRestart]);

  const start = useCallback(async () => {
    const lib = getSpeechLib();
    if (!enabledRef.current || !lib) {
      return;
    }
    clearRestart();
    try {
      if (!(await requestAndroidMic())) {
        setDenied(true);
        setListening(false);
        setError(messageForSpeechError('not-allowed'));
        return;
      }
      const permission = await lib.ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync();
      if (!permission.granted) {
        const both = await lib.ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!both.granted) {
          setDenied(true);
          setListening(false);
          setError(messageForSpeechError('not-allowed'));
          return;
        }
      }
      setDenied(false);
      if (
        typeof lib.ExpoSpeechRecognitionModule.isRecognitionAvailable === 'function' &&
        !lib.ExpoSpeechRecognitionModule.isRecognitionAvailable()
      ) {
        setError(messageForSpeechError('service-not-allowed'));
        setListening(false);
        return;
      }
      setError(null);
      lastHeardRef.current = '';
      deliveredRef.current = false;
      try {
        lib.ExpoSpeechRecognitionModule.abort();
      } catch {
        // First start has nothing to abort.
      }
      lib.ExpoSpeechRecognitionModule.start({
        lang: LANGS[langIndexRef.current],
        interimResults: true,
        continuous: supportsContinuousAndroid(),
      });
      setListening(true);
    } catch {
      setError(FALLBACK);
      setListening(false);
    }
  }, [clearRestart]);

  startRef.current = start;

  useEffect(() => {
    if (!enabled || !available) {
      stop();
      return;
    }
    start().catch(() => undefined);
    const onChange = (state: AppStateStatus) => {
      if (state !== 'active') {
        stop();
        return;
      }
      if (enabledRef.current) {
        start().catch(() => undefined);
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => {
      sub.remove();
      stop();
    };
  }, [available, enabled, start, stop]);

  return { listening, denied, error, available, start, stop, setError };
}
