function normalize(raw: string) {
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PLACE_CONFIRM = new Set([
  'confirm',
  'yes place the order',
  'place the order',
  'yes place order',
  'place order',
  'உறுதி',
  'ஆர்டர் செய்யலாம்',
  'confirm pannunga',
  'order pannunga',
]);

const SOFT_YES = new Set(['yes', 'ok', 'okay', 'seri', 'ஆமாம்', 'aamaam', 'aama']);

export function isPlaceConfirmPhrase(transcript: string) {
  return PLACE_CONFIRM.has(normalize(transcript));
}

export function isSoftYes(transcript: string) {
  return SOFT_YES.has(normalize(transcript));
}

export function isExplicitConfirm(transcript: string, waitingForConfirm = false) {
  const n = normalize(transcript);
  if (PLACE_CONFIRM.has(n)) {
    return true;
  }
  if (waitingForConfirm && (SOFT_YES.has(n) || n === 'aamaam' || n === 'aama')) {
    return true;
  }
  return false;
}

export function isExplicitYes(transcript: string) {
  const n = normalize(transcript);
  return (
    n === 'yes' ||
    n === 'ஆமாம்' ||
    n === 'seri' ||
    n === 'confirm' ||
    n === 'ok' ||
    n === 'okay'
  );
}
