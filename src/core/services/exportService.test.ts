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

type ShareCapableNavigator = Navigator & {
  canShare?: (data: { files?: File[] }) => boolean;
  share?: (data: { files?: File[]; title?: string }) => Promise<void>;
};

describe('shareOrDownload', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    const nav = navigator as unknown as Record<string, unknown>;
    Reflect.deleteProperty(nav, 'share');
    Reflect.deleteProperty(nav, 'canShare');
  });

  it('treats user-cancelled share as success without downloading', async () => {
    await putArticle(makeArticle({ id: 'a1' }));
    const nav = navigator as ShareCapableNavigator;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    nav.canShare = () => true;
    nav.share = vi.fn(() =>
      Promise.reject(Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' })),
    );
    await expect(exportTranscript('a1')).resolves.toBeUndefined();
    expect(nav.share).toHaveBeenCalledOnce();
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('rethrows non-abort share failures so callers can toast', async () => {
    await putArticle(makeArticle({ id: 'a1' }));
    const nav = navigator as ShareCapableNavigator;
    nav.canShare = () => true;
    nav.share = vi.fn(() => Promise.reject(new Error('permission denied')));
    await expect(exportTranscript('a1')).rejects.toThrow('permission denied');
  });
});
