export const CHUNK_SECONDS = 30;

export function chunkIndexForElapsed(seconds: number): number {
  return Math.floor(seconds / CHUNK_SECONDS);
}

/**
 * Character-level diff via longest common prefix/suffix.
 * Returns the replaced region: old[start..oldEnd) -> new[start..newEnd).
 */
export function computeEditRange(
  oldText: string,
  newText: string,
): { start: number; oldEnd: number; newEnd: number } {
  let start = 0;
  const maxPrefix = Math.min(oldText.length, newText.length);
  while (start < maxPrefix && oldText[start] === newText[start]) start++;

  let oldEnd = oldText.length;
  let newEnd = newText.length;
  while (oldEnd > start && newEnd > start && oldText[oldEnd - 1] === newText[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }
  return { start, oldEnd, newEnd };
}

import type { TranscriptSegment } from '../models';

export interface FinalResult {
  text: string;
  startTimeSec: number;
  endTimeSec: number;
}

export function adjustSegmentsAfterEdit(
  segments: TranscriptSegment[],
  oldText: string,
  newText: string,
): TranscriptSegment[] {
  if (oldText === newText) return segments;

  const { start, oldEnd, newEnd } = computeEditRange(oldText, newText);
  const delta = newText.length - oldText.length;

  return segments.map((s): TranscriptSegment => {
    // Entirely before the edited region -> untouched.
    if (s.endCharOffset < start) return s;
    // Entirely after -> shift by delta.
    if (s.startCharOffset >= oldEnd) {
      return {
        ...s,
        startCharOffset: s.startCharOffset + delta,
        endCharOffset: s.endCharOffset + delta,
      };
    }

    // Segment overlaps the edited region [start, oldEnd).
    if (s.startCharOffset >= start && s.endCharOffset < oldEnd) {
      // Fully inside: no surviving mapped text; collapse to zero-width at the
      // edit seam's position in NEW-text coordinates (newEnd, NOT start+delta —
      // they differ whenever trailing text shrank/grew by more than the seam).
      return { ...s, startCharOffset: newEnd, endCharOffset: newEnd - 1, approximate: true };
    }
    if (s.startCharOffset < start && s.endCharOffset >= oldEnd) {
      // Spanning the whole edit: expand, keep mapping, mark approximate.
      return { ...s, endCharOffset: s.endCharOffset + delta, approximate: true };
    }
    if (s.startCharOffset < start) {
      // Ends inside the edit: keep surviving prefix only.
      return { ...s, endCharOffset: start - 1, approximate: true };
    }
    // Starts inside the edit: keep surviving suffix only (seam = newEnd).
    return {
      ...s,
      startCharOffset: newEnd,
      endCharOffset: s.endCharOffset + delta,
      approximate: true,
    };
  });
}

export function buildTranscript(finals: FinalResult[]): {
  text: string;
  segments: Omit<TranscriptSegment, 'id' | 'articleId'>[];
} {
  let text = '';
  const segments: Omit<TranscriptSegment, 'id' | 'articleId'>[] = [];
  for (const f of finals) {
    if (text.length > 0) text += ' ';
    const wordStart = text.length;
    text += f.text;
    segments.push({
      startTimeSec: f.startTimeSec,
      endTimeSec: f.endTimeSec,
      startCharOffset: wordStart,
      endCharOffset: wordStart + f.text.length - 1,
      text: f.text,
      audioChunkIndex: chunkIndexForElapsed(f.startTimeSec),
      approximate: false,
    });
  }
  return { text, segments };
}
