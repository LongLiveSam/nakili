/** Audio analysis helpers — pure functions over PCM data (no DOM). */

export interface SilenceRange { startSec: number; endSec: number }

/**
 * Detect silence runs in mono PCM. A block of `blockMs` is silent when its
 * RMS stays below `threshold`. Runs shorter than `minRunMs` are ignored.
 */
export function detectSilenceRanges(
  pcm: Float32Array,
  sampleRate: number,
  opts: { blockMs?: number; threshold?: number; minRunMs?: number } = {},
): SilenceRange[] {
  const blockMs = opts.blockMs ?? 50;
  const threshold = opts.threshold ?? 0.008;
  const minRunMs = opts.minRunMs ?? 600;

  const blockSize = Math.max(1, Math.floor((sampleRate * blockMs) / 1000));
  const silent: boolean[] = [];
  for (let i = 0; i < pcm.length; i += blockSize) {
    let sum = 0;
    const end = Math.min(pcm.length, i + blockSize);
    for (let j = i; j < end; j++) sum += pcm[j] * pcm[j];
    const rms = Math.sqrt(sum / Math.max(1, end - i));
    silent.push(rms < threshold);
  }

  const ranges: SilenceRange[] = [];
  let runStart: number | null = null;
  for (let b = 0; b <= silent.length; b++) {
    const isSilent = b < silent.length ? silent[b] : false;
    if (isSilent && runStart === null) runStart = b;
    if (!isSilent && runStart !== null) {
      const runMs = (b - runStart) * blockMs;
      if (runMs >= minRunMs) {
        ranges.push({
          startSec: (runStart * blockMs) / 1000,
          endSec: (b * blockMs) / 1000,
        });
      }
      runStart = null;
    }
  }
  return ranges;
}

/** Snap a character position to the bounds of the word containing it. */
export function snapToWord(
  text: string,
  pos: number,
  lo = 0,
  hi = text.length,
): [number, number] {
  const clamp = (n: number) => Math.max(lo, Math.min(hi, n));
  const p = clamp(pos);
  // Whitespace positions snap to nothing — avoids highlighting a random neighbour.
  if (/[\s\n]/.test(text[p] ?? ' ')) return [p, p];
  const outOfBounds = (i: number) => i < lo || i > hi;
  let start = p;
  let end = p;
  while (!outOfBounds(start - 1) && !/[\s\n]/.test(text[start - 1] ?? ' ')) start--;
  while (!outOfBounds(end) && !/[\s\n]/.test(text[end] ?? ' ')) end++;
  return [start, end];
}
