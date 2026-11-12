import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import {
  listArticles, getArticle, putArticle, deleteArticleCascade,
  saveSessionAudio, getAudioBlob, putSegments, getSegments, getChunks,
} from './repositories';
import type { Article, TranscriptSegment } from '../models';

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

describe('articles', () => {
  it('round-trips and sorts newest first', async () => {
    await putArticle(makeArticle({ id: 'a1', updatedAt: 100 }));
    await putArticle(makeArticle({ id: 'a2', updatedAt: 200 }));
    const all = await listArticles();
    expect(all.map((a) => a.id)).toEqual(['a2', 'a1']);
    expect(await getArticle('a1')).toMatchObject({ title: 'Draft' });
  });

  it('cascade-deletes chunks, segments, and audio files', async () => {
    await putArticle(makeArticle());
    await saveSessionAudio('a1', [new Blob(['x'])]);
    await putSegments([{
      id: 's1', articleId: 'a1', startTimeSec: 0, endTimeSec: 2,
      startCharOffset: 0, endCharOffset: 4, text: 'hello',
      audioChunkIndex: 0, approximate: false,
    }]);
    await deleteArticleCascade('a1');
    expect((await db.articles.toArray()).length).toBe(0);
    expect((await getSegments('a1')).length).toBe(0);
    expect((await getChunks('a1')).length).toBe(0);
    expect((await db.audioFiles.toArray()).length).toBe(0);
  });
});

describe('audio', () => {
  it('stores ordered chunks with blob keys and returns blobs', async () => {
    await putArticle(makeArticle());
    const keys = await saveSessionAudio('a1', [new Blob(['aa']), new Blob(['bb'])]);
    expect(keys.length).toBe(2);
    const chunks = await getChunks('a1');
    expect(chunks.map((c) => c.index)).toEqual([0, 1]);
    const blob = await getAudioBlob(keys[0]);
    expect(await blob!.text()).toBe('aa');
  });

  it('uses real clip lengths when supplied (imports, trimmed audio)', async () => {
    await putArticle(makeArticle());
    await saveSessionAudio('a1', [new Blob(['a']), new Blob(['b'])], {
      chunkSeconds: 30,
      durationsSec: [11, 4.5],
    });
    const chunks = await getChunks('a1');
    expect(chunks[0]).toMatchObject({ startTimeSec: 0, endTimeSec: 11, durationSec: 11 });
    expect(chunks[1]).toMatchObject({ startTimeSec: 30, endTimeSec: 34.5, durationSec: 4.5 });
  });

  it('uses explicit start times for pause-aligned clips', async () => {
    await putArticle(makeArticle());
    await saveSessionAudio('a1', [new Blob(['a']), new Blob(['b'])], {
      startTimesSec: [0, 10],
      durationsSec: [10, 15],
    });
    const chunks = await getChunks('a1');
    expect(chunks[0]).toMatchObject({ startTimeSec: 0, endTimeSec: 10 });
    expect(chunks[1]).toMatchObject({ startTimeSec: 10, endTimeSec: 25 });
  });
});

describe('segments', () => {
  it('stores and fetches segments by article', async () => {
    const s: TranscriptSegment = {
      id: 's1', articleId: 'a1', startTimeSec: 0, endTimeSec: 1,
      startCharOffset: 0, endCharOffset: 2, text: 'hi',
      audioChunkIndex: 0, approximate: false,
    };
    await putSegments([s]);
    expect(await getSegments('a1')).toEqual([s]);
  });
});
