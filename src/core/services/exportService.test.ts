import { describe, it, expect } from 'vitest';
import { slugify } from './ExportService';

describe('slugify', () => {
  it.each([
    ['My Great Essay!', 'my-great-essay'],
    ['  spaced  out  ', 'spaced-out'],
    ['???', 'untitled'],
    ['', 'untitled'],
  ])('%s -> %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('truncates long titles to 64 chars', () => {
    const out = slugify('a'.repeat(100));
    expect(out.length).toBeLessThanOrEqual(64);
  });
});
