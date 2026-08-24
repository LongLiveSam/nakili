import { describe, it, expect } from 'vitest';
import { findSegmentForCursor } from './MappingService';
import type { TranscriptSegment } from '../models';

function seg(id: string, start: number, end: number, approx = false): TranscriptSegment {
  return {
    id, articleId: 'a1', startTimeSec: 0, endTimeSec: 1,
    startCharOffset: start, endCharOffset: end, text: 'x',
    audioChunkIndex: 0, approximate: approx,
  };
}

// "alpha bravo charlie"
const SEGS = [seg('s0', 0, 4), seg('s1', 6, 10), seg('s2', 12, 18)];

describe('findSegmentForCursor', () => {
  it('maps cursor inside a segment exactly', () => {
    const r = findSegmentForCursor(SEGS, 2);
    expect(r.segment!.id).toBe('s0');
    expect(r.approximate).toBe(false);
  });

  it('matches boundaries inclusively', () => {
    expect(findSegmentForCursor(SEGS, 4).segment!.id).toBe('s0');
    expect(findSegmentForCursor(SEGS, 6).segment!.id).toBe('s1');
    expect(findSegmentForCursor(SEGS, 18).segment!.id).toBe('s2');
  });

  it('falls back to nearest preceding in gaps, marked approximate', () => {
    const r = findSegmentForCursor(SEGS, 5);
    expect(r.segment!.id).toBe('s0');
    expect(r.approximate).toBe(true);
  });

  it('propagates approximate flag of matched segment', () => {
    const r = findSegmentForCursor([seg('a', 0, 4, true)], 2);
    expect(r.approximate).toBe(true);
  });

  it('falls forward when cursor precedes all segments', () => {
    const r = findSegmentForCursor([seg('z', 10, 20)], 0);
    expect(r.segment!.id).toBe('z');
    expect(r.approximate).toBe(true);
  });

  it('skips collapsed segments in search', () => {
    const collapsed = [seg('a', 0, 4), seg('c', 5, 4), seg('b', 6, 10)];
    const r = findSegmentForCursor(collapsed, 5);
    expect(r.segment!.id).toBe('a');
    expect(r.approximate).toBe(true);
  });

  it('returns null mapping with no segments', () => {
    expect(findSegmentForCursor([], 0)).toEqual({ segment: null, approximate: true });
  });
});
