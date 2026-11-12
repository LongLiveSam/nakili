import { describe, it, expect } from 'vitest';
import { computeEditRange, chunkIndexForElapsed } from './MappingService';

describe('chunkIndexForElapsed', () => {
  it.each([
    [0, 0], [29.9, 0], [30, 1], [59.99, 1], [60, 2],
  ])('%fs -> chunk %i', (sec, expected) => {
    expect(chunkIndexForElapsed(sec)).toBe(expected);
  });

  it('uses real clip starts when pause-aligned chunks are supplied', () => {
    const starts = [0, 10, 40];
    expect(chunkIndexForElapsed(0, starts)).toBe(0);
    expect(chunkIndexForElapsed(9.9, starts)).toBe(0);
    expect(chunkIndexForElapsed(10, starts)).toBe(1);
    expect(chunkIndexForElapsed(39.9, starts)).toBe(1);
    expect(chunkIndexForElapsed(40, starts)).toBe(2);
    expect(chunkIndexForElapsed(120, starts)).toBe(2);
  });
});

describe('computeEditRange', () => {
  it('detects pure insertion', () => {
    expect(computeEditRange('hello world', 'hello big world')).toEqual({
      start: 6, oldEnd: 6, newEnd: 10,
    });
  });

  it('detects pure deletion', () => {
    expect(computeEditRange('hello big world', 'hello world')).toEqual({
      start: 6, oldEnd: 10, newEnd: 6,
    });
  });

  it('detects replacement', () => {
    expect(computeEditRange('hello world', 'hello there')).toEqual({
      start: 6, oldEnd: 11, newEnd: 11,
    });
  });

  it('handles append at end', () => {
    expect(computeEditRange('abc', 'abcdef')).toEqual({ start: 3, oldEnd: 3, newEnd: 6 });
  });

  it('handles identical text', () => {
    expect(computeEditRange('same', 'same')).toEqual({ start: 4, oldEnd: 4, newEnd: 4 });
  });
});
