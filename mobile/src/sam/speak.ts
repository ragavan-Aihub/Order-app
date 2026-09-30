import * as Speech from 'expo-speech';

const MALE =
  /male|rishi|ravi|daniel|david|arthur|aaron|fred|alex|thomas|matthew|gordon|tom\b|mark\b|james|suresh|kumar|en-in-x-end|en-in-x-ene|en-gb-x-gbb|en-us-x-iol|ta-in-x-tad|hi-in-x-hid/i;
const FEMALE =
  /female|samantha|veena|heera|karen|moira|tessa|siri|lekha|priya|susan|victoria|serena|fiona|kate|anna|zira|hazel|en-in-x-enc|en-gb-x-gba|ta-in-x-tac/i;

let voicesPromise: Promise<Speech.Voice[]> | null = null;
let speakGeneration = 0;

function loadVoices() {
  if (!voicesPromise) {
    voicesPromise = Speech.getAvailableVoicesAsync().catch(() => []);
  }
  return voicesPromise;
}

function langScore(voice: Speech.Voice, lang: 'en' | 'ta' | 'mix') {
  const code = voice.language.replace('_', '-').toLowerCase();
  if (lang === 'ta') {
    if (code.startsWith('ta-in')) {
      return 3;
    }
    if (code.startsWith('ta')) {
      return 2;
    }
    return 0;
  }
  if (code.startsWith('en-in')) {
    return 3;
  }
  if (code.startsWith('en')) {
    return 1;
  }
  return 0;
}

function genderScore(voice: Speech.Voice) {
  const blob = `${voice.name} ${voice.identifier}`;
  if (FEMALE.test(blob)) {
    return -2;
  }
  if (MALE.test(blob)) {
    return 3;
  }
  return 0;
}

export async function pickSamVoice(lang: 'en' | 'ta' | 'mix') {
  const voices = await loadVoices();
  let best: Speech.Voice | null = null;
  let bestScore = -99;
  for (const voice of voices) {
    const language = langScore(voice, lang);
    if (language <= 0) {
      continue;
    }
    const score =
      language * 10 + genderScore(voice) + (voice.quality === Speech.VoiceQuality.Enhanced ? 1 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = voice;
    }
  }
  return best;
}

export async function speakSam(
  text: string,
  lang: 'en' | 'ta' | 'mix',
  handlers: {
    onDone?: () => void;
    onStopped?: () => void;
    onError?: () => void;
  },
) {
  const generation = ++speakGeneration;
  const voice = await pickSamVoice(lang);
  if (generation !== speakGeneration) {
    return;
  }
  const male = voice ? genderScore(voice) > 0 : false;
  Speech.speak(text, {
    language: lang === 'ta' ? 'ta-IN' : 'en-IN',
    voice: voice?.identifier,
    rate: 0.72,
    pitch: male ? 0.88 : 0.72,
    onDone: handlers.onDone,
    onStopped: handlers.onStopped,
    onError: handlers.onError,
  });
}
