import { describe, it, expect } from 'vitest';
import { applyVoiceCommands, planParagraphBreaks } from './formatting';

describe('applyVoiceCommands', () => {
  it('replaces paragraph and line commands', () => {
    const r = applyVoiceCommands('first part new paragraph second part new line third');
    expect(r.text).toBe('First part\n\nSecond part\nThird');
    expect(r.applied).toBe(2);
  });

  it('replaces punctuation commands and tidies spacing', () => {
    const r = applyVoiceCommands('hello period my name is Nakili comma hello question mark');
    expect(r.text).toBe('Hello. My name is Nakili, hello?');
  });

  it('capitalizes consistently on repeat passes', () => {
    const once = applyVoiceCommands('plain words only here').text;
    expect(applyVoiceCommands(once).text).toBe(once);
  });

  it('handles exclamation point variant', () => {
    expect(applyVoiceCommands('wow exclamation point').text).toBe('Wow!');
  });
});

describe('planParagraphBreaks', () => {
  // One segment covering 0-10s mapped to chars 0..19 (20 chars)
  const segs = [{ startTimeSec: 0, endTimeSec: 10, startCharOffset: 0, endCharOffset: 19 }];
  const text = 'A'.repeat(9) + ' ' + 'B'.repeat(10); // 20 chars

  it('interpolates a boundary at mid-segment', () => {
    const { text: out, insertOffsets } = planParagraphBreaks(text, segs, [5], 0);
    expect(insertOffsets).toEqual([10]);
    // Manual insertion check:
    const withBreak = out.slice(0, 10) + '\n\n' + out.slice(10);
    expect(withBreak.startsWith('AAAAAAAAA')).toBe(true);
    expect(withBreak).toContain('\n\n');
  });

  it('drops boundaries too close to an existing break or another insert', () => {
    const a = planParagraphBreaks(text, segs, [5, 5.2], 40);
    expect(a.insertOffsets.length).toBe(1); // min distance collapses the pair
  });

  it('ignores boundaries outside any segment', () => {
    const a = planParagraphBreaks(text, segs, [45]);
    expect(a.insertOffsets).toEqual([]);
  });

  it('skips insertion at very start/end of a segment', () => {
    const a = planParagraphBreaks(text, segs, [0.1, 9.95], 0);
    expect(a.insertOffsets).toEqual([]);
  });
});
