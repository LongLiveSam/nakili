import { v4 as uuid } from './uuid';
import { db } from './db';
import type { Article, AudioChunk, TranscriptSegment } from '../models';

export async function listArticles(): Promise<Article[]> {
  const all = await db.articles.toArray();
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getArticle(id: string) {
  return db.articles.get(id);
}

export function putArticle(a: Article) {
  return db.articles.put(a);
}

export async function deleteArticleCascade(id: string): Promise<void> {
  await db.transaction('rw', db.articles, db.audioChunks, db.transcriptSegments, db.audioFiles, async () => {
    const chunks = await getChunks(id);
    const keys = chunks.map((c) => c.blobKey);
    await db.audioChunks.where('articleId').equals(id).delete();
    await db.transcriptSegments.where('articleId').equals(id).delete();
    await db.articles.delete(id);
    await db.audioFiles.bulkDelete(keys);
  });
}

/** Stores chunk blobs in order; creates AudioChunk rows at nominal 30 s spacing. */
export async function saveSessionAudio(
  articleId: string,
  blobs: Blob[],
  chunkSeconds = 30,
): Promise<string[]> {
  const keys = blobs.map(() => uuid());
  const rows: AudioChunk[] = blobs.map((_, i) => ({
    id: uuid(),
    articleId,
    index: i,
    startTimeSec: i * chunkSeconds,
    endTimeSec: (i + 1) * chunkSeconds,
    blobKey: keys[i],
    durationSec: chunkSeconds,
  }));
  await db.transaction('rw', db.audioFiles, db.audioChunks, async () => {
    await db.audioFiles.bulkPut(rows.map((_r, i) => ({ key: keys[i], blob: blobs[i] })));
    await db.audioChunks.bulkPut(rows);
  });
  return keys;
}

export async function getAudioBlob(key: string): Promise<Blob | undefined> {
  const row = await db.audioFiles.get(key);
  return row?.blob;
}

export function putSegments(segs: TranscriptSegment[]) {
  return db.transcriptSegments.bulkPut(segs);
}

export async function getSegments(articleId: string): Promise<TranscriptSegment[]> {
  const rows = await db.transcriptSegments.where('articleId').equals(articleId).toArray();
  return rows.sort((a, b) => a.startCharOffset - b.startCharOffset);
}

export async function getChunks(articleId: string): Promise<AudioChunk[]> {
  const rows = await db.audioChunks
    .where('[articleId+index]')
    .between([articleId, 0], [articleId, Infinity])
    .toArray();
  return rows.sort((a, b) => a.index - b.index);
}
