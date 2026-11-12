import { describe, it, expect } from 'vitest';
import { detectSilenceRanges, snapToWord, trimSilence } from './audioAnalysis';

function pcmWithSilence(rate: number): Float32Array {
  // 0.5s tone, 1s silence, 0.5s tone = 2s total
  const total = rate * 2;
  const pcm = new Float32Array(total);
  for (let i = 0; i < rate * 0.5; i++) pcm[i] = Math.sin((2 * Math.PI * 440 * i) / rate) * 0.5;
  for (let i = Math.floor(rate * 1.5); i < rate * 2; i++) {
    pcm[i] = Math.sin((2 * Math.PI * 440 * i) / rate) * 0.5;
  }
  return pcm;
}

describe('detectSilenceRanges', () => {
  it('finds the silent run between tones', () => {
    const rate = 16000;
    const ranges = detectSilenceRanges(pcmWithSilence(rate), rate, { minRunMs: 600 });
    expect(ranges.length).toBe(1);
    expect(ranges[0].startSec).toBeGreaterThanOrEqual(0.45);
    expect(ranges[0].startSec).toBeLessThanOrEqual(0.55);
    expect(ranges[0].endSec).toBeGreaterThanOrEqual(1.45);
    expect(ranges[0].endSec).toBeLessThanOrEqual(1.55);
  });

  it('ignores short gaps below minRunMs', () => {
    const rate = 16000;
    const ranges = detectSilenceRanges(pcmWithSilence(rate), rate, { minRunMs: 2000 });
    expect(ranges).toEqual([]);
  });

  it('returns empty for constant tone', () => {
    const rate = 8000;
    const pcm = new Float32Array(rate);
    for (let i = 0; i < pcm.length; i++) pcm[i] = 0.5;
    expect(detectSilenceRanges(pcm, rate)).toEqual([]);
  });
});

describe('snapToWord', () => {
  const text = 'alpha beta gamma';

  it('snaps to the word under the position', () => {
    expect(snapToWord(text, 7, 0, text.length)).toEqual([6, 10]); // "beta"
  });

  it('respects segment bounds', () => {
    expect(snapToWord(text, 8, 6, 10)).toEqual([6, 10]);
  });

  it('clamps to bounds on whitespace', () => {
    expect(snapToWord(text, 5, 0, text.length)).toEqual([5, 5]); // the space
  });
});

describe('trimSilence', () => {
  const rate = 16000;

  it('drops leading and trailing silence but keeps the speech', () => {
    const pcm = new Float32Array(rate * 3);
    for (let i = rate; i < rate * 2; i++) pcm[i] = 0.4;
    const trimmed = trimSilence(pcm, rate, { padMs: 0 });
    expect(trimmed.length).toBeGreaterThan(rate * 0.9);
    expect(trimmed.length).toBeLessThan(rate * 1.1);
  });

  it('returns an empty array for a silent clip', () => {
    expect(trimSilence(new Float32Array(rate), rate).length).toBe(0);
  });

  it('keeps a clip that is loud from the first sample', () => {
    const pcm = new Float32Array(rate);
    pcm.fill(0.3);
    expect(trimSilence(pcm, rate, { padMs: 0 }).length).toBe(rate);
  });
});
