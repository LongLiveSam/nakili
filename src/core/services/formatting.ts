/**
 * Dictation formatting helpers — pure functions, fully unit-tested.
 * Layered paragraph strategy:
 *   1. Explicit voice commands (highest priority)
 *   2. Silence-boundary auto-paragraphing (prosody)
 *   3. Sentence-based formatting pass
 *   4. Manual editing (Ctrl+Enter) — lives in the editor
 */

export interface CommandResult {
  text: string;
  applied: number;
}

const COMMANDS: Array<[RegExp, string]> = [
  [/\bnew paragraph\b/gi, '\n\n'],
  [/\bnew line\b|\bline break\b/gi, '\n'],
  [/\bfull stop\b|\bperiod\b/gi, '.'],
  [/\bcomma\b/gi, ','],
  [/\bquestion mark\b/gi, '?'],
  [/\bexclamation (mark|point)\b/gi, '!'],
];

/** Replace spoken commands with their characters. Idempotent. */
export function applyVoiceCommands(text: string): CommandResult {
  let out = text;
  let applied = 0;
  for (const [re, replacement] of COMMANDS) {
    out = out.replace(re, () => {
      applied++;
      return replacement;
    });
  }
  // Tidy space around inserted punctuation/breaks; capitalize sentence starts.
  out = out
    .replace(/[ \t]+([,.!?\n])/g, '$1')
    .replace(/([,.!?])(?=[A-Za-z])/g, '$1 ')
    .replace(/([.!?])\s+([a-z])/g, (_m, p: string, c: string) => `${p} ${c.toUpperCase()}`)
    .replace(/\n[ \t]*([a-z])/g, (_m, c: string) => `\n${c.toUpperCase()}`)
    .replace(/^([a-z])/, (c) => c.toUpperCase());
  return { text: out.replace(/[ \t]{2,}/g, ' ').trim(), applied };
}

export interface SegmentLike {
  startTimeSec: number;
  endTimeSec: number;
  startCharOffset: number;
}

/**
 * Insert "\n\n" at the character position corresponding to each detected
 * silence boundary (prosody). Positions are derived by finding the segment
 * active at the boundary time and interpolating within its text.
 * Returns the new text plus per-insertion offsets (ascending).
 */
export function planParagraphBreaks(
  text: string,
  segments: Array<SegmentLike & { endCharOffset: number }>,
  boundaryTimesSec: number[],
  minLengthBetween = 40,
): { text: string; insertOffsets: number[] } {
  const offsets: number[] = [];
  for (const t of [...boundaryTimesSec].sort((a, b) => a - b)) {
    const seg = segments.find((s) => t >= s.startTimeSec && t <= s.endTimeSec);
    if (!seg) continue;
    const span = Math.max(1, seg.endTimeSec - seg.startTimeSec);
    const ratio = Math.max(0, Math.min(1, (t - seg.startTimeSec) / span));
    const len = seg.endCharOffset - seg.startCharOffset + 1;
    const local = Math.round(len * ratio);
    if (local <= 0 || local >= len) continue;
    offsets.push(seg.startCharOffset + local);
  }
  // Collapse offsets that land too close together or near existing breaks.
  const cleaned: number[] = [];
  for (const off of offsets.sort((a, b) => a - b)) {
    const prev = cleaned[cleaned.length - 1];
    if (prev !== undefined && off - prev < minLengthBetween) continue;
    if (text.slice(Math.max(0, off - 2), off + 2).includes('\n')) continue;
    cleaned.push(off);
  }
  return { text, insertOffsets: cleaned };
}

/** Unambiguous filler words swept after dictation ('like'/'kinda' excluded on purpose). */
const FILLER_RE = /\b(um+|uh+|erm|hmm+|you know)\b[,.]?\s*/gi;

export interface FillerHit { start: number; end: number; word: string }

export function findFillers(text: string): FillerHit[] {
  const hits: FillerHit[] = [];
  for (const m of text.matchAll(FILLER_RE)) {
    hits.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].trim().length, word: m[0].trim() });
  }
  return hits;
}

/** Smart quotes, em-dash from '--', ellipsis from '...'. */
export function smartTypography(text: string): string {
  return text
    .replace(/\.{3}/g, '\u2026')
    .replace(/(\w)--(?=\w)/g, '$1\u2014')
    .replace(/--/g, '\u2014')
    .replace(/(^|[\s([{])"/g, '$1\u201C')
    .replace(/"/g, '\u201D')
    .replace(/(^|[\s([{])'/g, '$1\u2018')
    .replace(/'/g, '\u2019');
}
