import type { SamLanguage } from '@/lib/sam/types';

const TAMIL = /[\u0B80-\u0BFF]/;
const TANGLISH =
  /\b(venum|venu|pannunga|pannu|seri|rendu|oru|moonu|naalu|add|pickle|oorukai|urugai)\b/i;

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
