import type { DetectedLlmLanguage, SamLanguage } from '@/lib/sam/types';

const TAMIL = /[\u0B80-\u0BFF]/;
const TANGLISH =
  /\b(venum|venu|pannunga|pannu|seri|rendu|oru|onnu|moonu|naalu|anju|anai|vendaam|vendam|sertukonga|add|pickle|oorukai|urugai)\b/i;

export function detectLanguage(transcript: string): SamLanguage {
  const hasTamil = TAMIL.test(transcript);
  const hasLatin = /[a-zA-Z]/.test(transcript);
  if (hasTamil && hasLatin) {
    return 'mix';
  }
  if (hasTamil) {
    return 'ta';
  }
  if (TANGLISH.test(transcript) && hasLatin) {
    return 'mix';
  }
  return 'en';
}

export function transcriptToLlmLanguage(transcript: string): DetectedLlmLanguage {
  const lang = detectLanguage(transcript);
  if (lang === 'ta') {
    return 'ta';
  }
  if (lang === 'mix') {
    return 'tanglish';
  }
  return 'en';
}

export function mapLlmLanguage(lang?: DetectedLlmLanguage): SamLanguage | null {
  if (!lang) {
    return null;
  }
  if (lang === 'ta') {
    return 'ta';
  }
  if (lang === 'tanglish') {
    return 'mix';
  }
  return 'en';
}
