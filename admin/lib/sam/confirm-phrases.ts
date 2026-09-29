function normalize(raw: string) {
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ALLOWED = new Set([
  'confirm',
  'yes',
  'yes place the order',
  'place the order',
  'yes place order',
  'place order',
  'ஆமாம்',
  'உறுதி',
  'ஆர்டர் செய்யலாம்',
  'confirm pannunga',
  'order pannunga',
  'seri',
]);

export function isExplicitConfirm(transcript: string) {
  const n = normalize(transcript);
  if (ALLOWED.has(n)) {
    return true;
  }
  if (n === 'aamaam' || n === 'aama') {
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
