import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { slugify, exportTranscript } from './ExportService';
import { putArticle } from '../db/repositories';
import { db } from '../db/db';
import type { Article } from '../models';

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: 'a1', title: 'Draft', createdAt: 1, updatedAt: 1,
    durationSec: 0, transcriptText: '', ...overrides,
  };
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

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

// Exports always download (the Web Share sheet's cancel path is
// indistinguishable from failure in the UI), so these verify the download
// path directly regardless of navigator.share availability.
describe('export downloads', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads the transcript as <slug>.txt', async () => {
    await putArticle(makeArticle({ id: 'a1', transcriptText: 'hello world' }));
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const appended: HTMLAnchorElement[] = [];
    vi.spyOn(document.body, 'appendChild').mockImplementation(((node: Node) => {
      appended.push(node as HTMLAnchorElement);
      return node;
    }) as never);
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');

    await exportTranscript('a1');

    expect(appended.length).toBe(1);
    expect(appended[0].download).toBe('draft.txt');
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock');
  });

  it('throws for a missing article so callers can toast', async () => {
    await expect(exportTranscript('missing')).rejects.toThrow(/not found/);
  });
});
