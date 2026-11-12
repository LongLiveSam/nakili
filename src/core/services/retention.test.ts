import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/db';
import {
  getAudioBlob, getChunks, getSegments, putArticle, putSegments, saveSessionAudio,
} from '../db/repositories';
import {
  RETENTION_KEY,
  pressureLevel,
  pressurePercent,
  pruneAudioForArticles,
  pruneExpiredAudio,
  readRetentionChoice,
  retentionCutoff,
} from './retention';
import type { Article, TranscriptSegment } from '../models';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: 'a1', title: 'Draft', createdAt: 1, updatedAt: 1,
    durationSec: 0, transcriptText: 'kept text', ...overrides,
  };
}

function segment(overrides: Partial<TranscriptSegment> = {}): TranscriptSegment {
  return {
    id: 's1', articleId: 'a1', startTimeSec: 0, endTimeSec: 2,
    startCharOffset: 0, endCharOffset: 4, text: 'hello',
    audioChunkIndex: 0, approximate: false, ...overrides,
  };
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  localStorage.clear();
});

describe('retention choices', () => {
  it('defaults to keeping audio forever', () => {
    expect(readRetentionChoice()).toBe('forever');
  });

  it('reads a stored window', () => {
    localStorage.setItem(RETENTION_KEY, '90');
    expect(readRetentionChoice()).toBe('90');
  });

  it('falls back to forever on an unknown value', () => {
    localStorage.setItem(RETENTION_KEY, '2 weeks');
    expect(readRetentionChoice()).toBe('forever');
  });

  it('turns a window into a timestamp', () => {
    expect(retentionCutoff('forever', NOW)).toBeNull();
    expect(retentionCutoff('30', NOW)).toBe(NOW - 30 * DAY);
    expect(retentionCutoff('365', NOW)).toBe(NOW - 365 * DAY);
  });
});

describe('pressure', () => {
  it('reports a percentage and handles an unknown quota', () => {
    expect(pressurePercent(50, 100)).toBe(50);
    expect(pressurePercent(75, 0)).toBe(0);
    expect(pressurePercent(0, 0)).toBe(0);
  });

  it('bands the percentage', () => {
    expect(pressureLevel(10, 100)).toBe('ok');
    expect(pressureLevel(74, 100)).toBe('ok');
    expect(pressureLevel(75, 100)).toBe('warn');
    expect(pressureLevel(89, 100)).toBe('warn');
    expect(pressureLevel(90, 100)).toBe('critical');
    expect(pressureLevel(100, 100)).toBe('critical');
  });
});

describe('pruneAudioForArticles', () => {
  it('removes audio older than the cutoff and keeps transcripts', async () => {
    await putArticle(makeArticle({ id: 'old', updatedAt: NOW - 40 * DAY }));
    await putArticle(makeArticle({ id: 'new', updatedAt: NOW - 10 * DAY, transcriptText: 'new text' }));
    await saveSessionAudio('old', [new Blob(['aaaa']), new Blob(['bbbb'])]);
    await saveSessionAudio('new', [new Blob(['cccc'])]);
    await putSegments([
      segment({ id: 's-old', articleId: 'old' }),
      segment({ id: 's-new', articleId: 'new' }),
    ]);

    const result = await pruneAudioForArticles(NOW - 30 * DAY);

    expect(result.articles).toBe(1);
    expect(result.chunks).toBe(2);
    expect(result.bytes).toBe(8);
    expect(await getChunks('old')).toEqual([]);
    expect(await getChunks('new')).toHaveLength(1);

    const oldSegments = await getSegments('old');
    expect(oldSegments).toHaveLength(1);
    expect(oldSegments[0]).toMatchObject({ text: 'hello', approximate: true });

    const oldArticle = await db.articles.get('old');
    expect(oldArticle?.transcriptText).toBe('kept text');
    const newSegments = await getSegments('new');
    expect(newSegments[0].approximate).toBe(false);
  });

  it('deletes the underlying blobs', async () => {
    await putArticle(makeArticle({ id: 'old', updatedAt: 0 }));
    const keys = await saveSessionAudio('old', [new Blob(['x'])]);
    await pruneAudioForArticles(NOW);
    expect(await getAudioBlob(keys[0])).toBeUndefined();
  });

  it('is a no-op when nothing is older than the cutoff', async () => {
    await putArticle(makeArticle({ id: 'new', updatedAt: NOW }));
    await saveSessionAudio('new', [new Blob(['x'])]);
    await expect(pruneAudioForArticles(NOW - DAY)).resolves.toEqual({
      articles: 0, chunks: 0, bytes: 0,
    });
    expect(await getChunks('new')).toHaveLength(1);
  });

  it('does not count articles that never had audio', async () => {
    await putArticle(makeArticle({ id: 'textonly', updatedAt: 0 }));
    const result = await pruneAudioForArticles(NOW);
    expect(result).toEqual({ articles: 0, chunks: 0, bytes: 0 });
  });
});

describe('pruneExpiredAudio', () => {
  it('does nothing when the choice is forever', async () => {
    await putArticle(makeArticle({ id: 'old', updatedAt: 0 }));
    await saveSessionAudio('old', [new Blob(['x'])]);
    await expect(pruneExpiredAudio(NOW)).resolves.toBeNull();
    expect(await getChunks('old')).toHaveLength(1);
  });

  it('prunes using the stored window', async () => {
    localStorage.setItem(RETENTION_KEY, '30');
    await putArticle(makeArticle({ id: 'old', updatedAt: NOW - 40 * DAY }));
    await putArticle(makeArticle({ id: 'recent', updatedAt: NOW - 10 * DAY }));
    await saveSessionAudio('old', [new Blob(['x'])]);
    await saveSessionAudio('recent', [new Blob(['y'])]);

    const result = await pruneExpiredAudio(NOW);
    expect(result).toEqual({ articles: 1, chunks: 1, bytes: 1 });
    expect(await getChunks('old')).toEqual([]);
    expect(await getChunks('recent')).toHaveLength(1);
  });
});
