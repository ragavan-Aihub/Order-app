import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

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
    return 'Microphone permission is off. Allow it in Settings, or type your request.';
  }
  if (code === 'service-not-allowed') {
    return 'Voice recognition is not available. Install Google Speech / Google app, then try again.';
  }
  if (code === 'network') {
    return 'Voice needs an internet connection. You can type your request instead.';
  }
  return FALLBACK;
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
    if (!ok && !isExpoGo()) {
      setError(FALLBACK);
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
        if (!text || !event.isFinal) {
          return;
        }
        langIndexRef.current = 0;
        onFinalRef.current(text);
      },
    );
    const endSub = lib.ExpoSpeechRecognitionModule.addListener('end', () => {
      setListening(false);
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
      try {
        lib.ExpoSpeechRecognitionModule.abort();
      } catch {
        // First start has nothing to abort.
      }
      lib.ExpoSpeechRecognitionModule.start({
        lang: LANGS[langIndexRef.current],
        interimResults: false,
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

  return { listening, denied, error, start, stop, setError };
}
