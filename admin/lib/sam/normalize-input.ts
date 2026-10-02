const WRAPPERS = [
  /^(please|pls|plz|kindly)\s+/i,
  /^(can you|could you|would you|will you|can u)\s+/i,
  /^(i would like|i'd like|i wanna|i want|i need)\s+(to\s+)?/i,
  /^(get me|give me|send me)\s+/i,
];

export function stripShoppingWrapper(transcript: string) {
  let t = transcript
    .trim()
    .toLowerCase()
    .replace(/[?.!,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  t = t.replace(/^(hey\s+)?sam\s+/i, '');
  for (let i = 0; i < 4; i += 1) {
    let next = t;
    for (const re of WRAPPERS) {
      next = next.replace(re, '');
    }
    if (next === t) {
      break;
    }
    t = next;
  }
  return t
    .replace(/\s+(please|pls|plz|for me)$/i, '')
    .replace(/\s+(into|to|in)\s+(the\s+)?(my\s+)?cart$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripQueryNoise(raw: string) {
  return raw
    .replace(
      /\b(please|pls|kindly|add|put|into|cart|to cart|for me|can you|could you|i want|i need|give me|pannunga|pannu|venum|venu|sertukonga|the|a|an)\b/gi,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeTranscript(transcript: string) {
  return stripShoppingWrapper(transcript);
}
