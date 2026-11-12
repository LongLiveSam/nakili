import { describe, it, expect } from 'vitest';
import { adjustSegmentsAfterEdit, buildTranscript, type FinalResult } from './MappingService';
import type { TranscriptSegment } from '../models';

function seg(partial: Partial<TranscriptSegment>): TranscriptSegment {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    articleId: 'a1',
    startTimeSec: 0, endTimeSec: 1,
    startCharOffset: 0, endCharOffset: 0,
    text: 'x', audioChunkIndex: 0, approximate: false,
    ...partial,
  };
}

// Text: "alpha bravo charlie"
//        0-4    6-10   12-18   (inclusive char offsets)
const BASE_SEGS = [
  seg({ id: 'segA', text: 'alpha', startCharOffset: 0, endCharOffset: 4 }),
  seg({ id: 'segB', text: 'bravo', startCharOffset: 6, endCharOffset: 10 }),
  seg({ id: 'segC', text: 'charlie', startCharOffset: 12, endCharOffset: 18 }),
];
const BASE_TEXT = 'alpha bravo charlie';

describe('adjustSegmentsAfterEdit', () => {
  it('returns same array when text unchanged', () => {
    expect(adjustSegmentsAfterEdit(BASE_SEGS, BASE_TEXT, BASE_TEXT)).toBe(BASE_SEGS);
  });

  it('shifts later segments after an insertion before them', () => {
    const newText = 'alpha XX bravo charlie'; // inserted "XX " at offset 6
    const out = adjustSegmentsAfterEdit(BASE_SEGS, BASE_TEXT, newText);
    expect(out.find((s) => s.id === 'segB')).toMatchObject({
      startCharOffset: 9, endCharOffset: 13, approximate: false,
    });
    expect(out.find((s) => s.id === 'segC')).toMatchObject({
      startCharOffset: 15, endCharOffset: 21, approximate: false,
    });
  });

  it('marks a deleted segment approximate and collapses it at the edit point', () => {
    // "bravo" removed entirely -> "alpha  charlie"
    const newText = 'alpha  charlie';
    const out = adjustSegmentsAfterEdit(BASE_SEGS, BASE_TEXT, newText);
    expect(out.find((s) => s.id === 'segA')).toMatchObject({ startCharOffset: 0, endCharOffset: 4, approximate: false });
    const b = out.find((s) => s.id === 'segB')!;
    expect(b.approximate).toBe(true);
    expect(b.endCharOffset).toBeLessThan(b.startCharOffset + 1); // collapsed to <= zero-width
    expect(out.find((s) => s.id === 'segC')).toMatchObject({ startCharOffset: 7, endCharOffset: 13, approximate: false });
  });

  it('keeps a segment mapped-but-approximate when inserting inside it', () => {
    // insert inside "bravo": "alpha braXvo charlie"
    const newText = 'alpha braXvo charlie';
    const out = adjustSegmentsAfterEdit(BASE_SEGS, BASE_TEXT, newText);
    expect(out.find((s) => s.id === 'segB')).toMatchObject({ approximate: true });
    expect(out.find((s) => s.id === 'segB')!.endCharOffset).toBeGreaterThan(10); // expanded
    expect(out.find((s) => s.id === 'segC')).toMatchObject({ startCharOffset: 13, endCharOffset: 19, approximate: false });
  });

  it('never deletes segments even when all their text is replaced', () => {
    const out = adjustSegmentsAfterEdit([BASE_SEGS[0]], 'alpha', 'zzz');
    expect(out.length).toBe(1);
    expect(out[0].approximate).toBe(true);
  });

  it('handles deletion spanning the end of one segment into a gap', () => {
    // delete "o br" (offsets 9..13 exclusive end) -> "alpha bavo charlie"? 
    // Simpler: delete chars 8..13 ("vo ch") -> "alpha brarlie"
    const newText = 'alpha brarlie';
    const out = adjustSegmentsAfterEdit(BASE_SEGS, BASE_TEXT, newText);
    expect(out.length).toBe(3);
    expect(out.find((s) => s.id === 'segB')!.approximate).toBe(true);
    expect(out.find((s) => s.id === 'segC')!.approximate).toBe(true);
  });
});

describe('buildTranscript', () => {
  it('joins finals with spaces and assigns offsets and chunk indexes', () => {
    const finals: FinalResult[] = [
      { text: 'Hello world', startTimeSec: 1, endTimeSec: 3 },
      { text: 'second part', startTimeSec: 31, endTimeSec: 34 },
    ];
    const { text, segments } = buildTranscript(finals);
    expect(text).toBe('Hello world second part');
    expect(segments[0]).toMatchObject({
      startCharOffset: 0, endCharOffset: 10, audioChunkIndex: 0,
      startTimeSec: 1, endTimeSec: 3, approximate: false,
    });
    expect(segments[1]).toMatchObject({
      startCharOffset: 12, endCharOffset: 22, audioChunkIndex: 1,
      startTimeSec: 31, endTimeSec: 34, approximate: false,
    });
  });

  it('returns empty for no finals', () => {
    expect(buildTranscript([])).toEqual({ text: '', segments: [] });
  });

  it('maps phrases to pause-aligned clips by their real start times', () => {
    const finals: FinalResult[] = [
      { text: 'before pause', startTimeSec: 2, endTimeSec: 4 },
      { text: 'after pause', startTimeSec: 12, endTimeSec: 14 },
    ];
    const { segments } = buildTranscript(finals, [0, 10]);
    expect(segments[0].audioChunkIndex).toBe(0);
    expect(segments[1].audioChunkIndex).toBe(1);
  });
});
