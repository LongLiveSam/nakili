/**
 * Custom-vocabulary correction — ported from Handy's
 * `audio_toolkit/text.rs::apply_custom_words` (MIT).
 *
 * The Web Speech API ignores `SpeechGrammarList` in Chrome, so handing the
 * recognizer a vocabulary list is only a hint at best. This pass fixes what the
 * recognizer actually emitted: fuzzy (Levenshtein) and phonetic (Soundex)
 * matching of 1–3 word n-grams against the user's terms.
 *
 * Differences from the Rust original, both deliberate:
 * - Whitespace between words is preserved verbatim (the original rejoins with
 *   single spaces, which would flatten Nakili's paragraph breaks).
 * - Only words that changed are reported, for pipeline accounting.
 */

export interface VocabCorrection {
  from: string;
  to: string;
  score: number;
}

export interface VocabResult {
  text: string;
  corrections: VocabCorrection[];
}

export interface VocabOptions {
  /** Maximum accepted similarity score; lower is stricter. Handy's default. */
  threshold?: number;
  /** Set false to rely on edit distance alone. */
  phonetic?: boolean;
}

const DEFAULT_THRESHOLD = 0.18;
const MAX_NGRAM_WORDS = 3;
const MAX_CANDIDATE_CHARS = 50;

const SOUNDEX_CODES: Record<string, string> = {
  b: '1', f: '1', p: '1', v: '1',
  c: '2', g: '2', j: '2', k: '2', q: '2', s: '2', x: '2', z: '2',
  d: '3', t: '3',
  l: '4',
  m: '5', n: '5',
  r: '6',
};

/** American Soundex, 4 characters. Empty for input without ASCII letters. */
export function soundex(word: string): string {
  const letters = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!letters) return '';
  const first = letters[0];
  let out = first.toUpperCase();
  let lastCode = SOUNDEX_CODES[first] ?? '';
  for (let i = 1; i < letters.length && out.length < 4; i++) {
    const ch = letters[i];
    if (ch === 'h' || ch === 'w') continue; // neither separates nor resets
    const code = SOUNDEX_CODES[ch] ?? '';
    if (!code) {
      lastCode = ''; // vowels and y reset duplicate suppression
      continue;
    }
    if (code !== lastCode) out += code;
    lastCode = code;
  }
  return (out + '000').slice(0, 4);
}

interface Token {
  raw: string;
  start: number;
  end: number;
}

interface TermKey {
  term: string;
  key: string;
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const re = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    tokens.push({ raw: match[0], start: match.index, end: match.index + match[0].length });
  }
  return tokens;
}

function isAlnum(ch: string): boolean {
  return /[\p{L}\p{N}]/u.test(ch);
}

function chars(word: string): string[] {
  return Array.from(word);
}

/** Lowercased alphanumerics only, with '&' spoken as "and" (e.g. "B&Q"). */
function matchKey(word: string): string {
  return chars(word.replace(/&/g, ' and ').toLowerCase())
    .filter(isAlnum)
    .join('');
}

function prefixPunct(word: string): string {
  const list = chars(word);
  const end = list.findIndex(isAlnum);
  return end <= 0 ? '' : list.slice(0, end).join('');
}

function suffixPunct(word: string): string {
  const list = chars(word);
  let start = list.length;
  while (start > 0 && !isAlnum(list[start - 1])) start--;
  return start >= list.length ? '' : list.slice(start).join('');
}

function isFuzzyKey(key: string): boolean {
  return key.length > 0 && /^[a-z0-9]+$/.test(key);
}

function buildTermKeys(terms: string[]): TermKey[] {
  const keys: TermKey[] = [];
  for (const term of terms) {
    const trimmed = term.trim();
    if (!trimmed) continue;
    const primary = matchKey(trimmed);
    if (isFuzzyKey(primary)) keys.push({ term: trimmed, key: primary });
    if (trimmed.includes('&')) {
      const expanded = matchKey(trimmed.replace(/&/g, ' and '));
      if (isFuzzyKey(expanded) && expanded !== primary) keys.push({ term: trimmed, key: expanded });
    }
  }
  return keys;
}

/** Levenshtein distance over code points, two-row dynamic programming. */
export function editDistance(a: string, b: string): number {
  const left = chars(a);
  const right = chars(b);
  if (left.length === 0) return right.length;
  if (right.length === 0) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 1; i <= left.length; i++) {
    const current = [i];
    for (let j = 1; j <= right.length; j++) {
      const substitution = previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1);
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, substitution);
    }
    previous = current;
  }
  return previous[right.length];
}

function phoneticMatch(a: string, b: string): boolean {
  if (!/^[a-z]+$/.test(a) || !/^[a-z]+$/.test(b)) return false;
  return soundex(a) === soundex(b);
}

function findBestMatch(
  candidateKey: string,
  keys: TermKey[],
  threshold: number,
  usePhonetic: boolean,
  requiredPrefix?: string,
): { term: string; score: number } | null {
  if (!isFuzzyKey(candidateKey) || chars(candidateKey).length > MAX_CANDIDATE_CHARS) return null;
  const candidateLength = chars(candidateKey).length;
  let best: { term: string; score: number } | null = null;
  for (const entry of keys) {
    // A multi-word n-gram may only absorb words that lead into the term:
    // "charge b" → ChargeBee, but never "on Kubernetes" → Kubernetes.
    if (requiredPrefix && (requiredPrefix.length < 3 || !entry.key.startsWith(requiredPrefix))) {
      continue;
    }
    const termLength = chars(entry.key).length;
    const maxLength = Math.max(candidateLength, termLength);
    const maxAllowedDiff = Math.max(maxLength * 0.25, 2);
    if (Math.abs(candidateLength - termLength) > maxAllowedDiff) continue;

    let score = maxLength > 0 ? editDistance(candidateKey, entry.key) / maxLength : 1;
    if (usePhonetic && phoneticMatch(candidateKey, entry.key)) score *= 0.3;
    if (score < threshold && (!best || score < best.score)) best = { term: entry.term, score };
  }
  return best;
}

/** Keep the recogniser's casing flavour when swapping in a vocabulary term. */
function preserveCase(original: string, replacement: string): string {
  const letters = chars(original).filter(isAlnum).join('');
  if (letters && letters === letters.toUpperCase() && letters !== letters.toLowerCase()) {
    return replacement.toUpperCase();
  }
  const firstLetter = chars(original).find(isAlnum);
  if (firstLetter && firstLetter === firstLetter.toUpperCase()) {
    const out = chars(replacement);
    out[0] = out[0]?.toUpperCase() ?? out[0];
    return out.join('');
  }
  return replacement;
}

export function applyVocabulary(text: string, terms: string[], options: VocabOptions = {}): VocabResult {
  const keys = buildTermKeys(terms);
  if (keys.length === 0) return { text, corrections: [] };

  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const usePhonetic = options.phonetic ?? true;
  const tokens = tokenize(text);
  const pieces: string[] = [];
  const corrections: VocabCorrection[] = [];
  let cursor = 0;
  let i = 0;

  while (i < tokens.length) {
    let best: { words: number; term: string; score: number } | null = null;
    const maxWords = Math.min(MAX_NGRAM_WORDS, tokens.length - i);
    for (let words = maxWords; words >= 1; words--) {
      // Never swallow a word past punctuation ("Charge B, che").
      let blocked = false;
      for (let k = 0; k < words - 1; k++) {
        if (suffixPunct(tokens[i + k].raw)) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      const key = tokens
        .slice(i, i + words)
        .map((token) => matchKey(token.raw))
        .join('');
      const firstKey = words > 1 ? matchKey(tokens[i].raw) : undefined;
      const match = findBestMatch(key, keys, threshold, usePhonetic, firstKey);
      if (match && (!best || match.score < best.score)) {
        best = { words, term: match.term, score: match.score };
      }
    }

    if (!best) {
      i++;
      continue;
    }

    const first = tokens[i];
    const last = tokens[i + best.words - 1];
    const corrected = preserveCase(first.raw, best.term);
    const replacement = `${prefixPunct(first.raw)}${corrected}${suffixPunct(last.raw)}`;
    pieces.push(text.slice(cursor, first.start), replacement);
    cursor = last.end;
    const original = text.slice(first.start, last.end);
    if (replacement !== original) {
      corrections.push({ from: original, to: replacement, score: best.score });
    }
    i += best.words;
  }

  pieces.push(text.slice(cursor));
  return { text: pieces.join(''), corrections };
}
