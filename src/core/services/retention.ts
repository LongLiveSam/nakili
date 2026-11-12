/**
 * Audio retention and storage pressure — the web counterpart of Handy's
 * `recording_retention_period` and `history_limit` settings.
 *
 * Nakili keeps transcripts forever: text is tiny and is the thing users care
 * about. Audio is what fills the origin quota, and when the quota is hit the
 * browser may evict the whole database. A retention window lets the user trade
 * old audio for headroom without losing a word of the transcript.
 *
 * Deleting audio is destructive, so the default is `forever` and pruning only
 * runs for a window the user explicitly picked. Affected segments are marked
 * `approximate`, exactly as `deleteClip` does.
 */

import { db } from '../db/db';
import { getChunks } from '../db/repositories';

export const RETENTION_KEY = 'nakili-audio-retention';

export type RetentionChoice = 'forever' | '30' | '90' | '365';

const CHOICES: readonly RetentionChoice[] = ['forever', '30', '90', '365'];
const DAY_MS = 24 * 60 * 60 * 1000;

export type PressureLevel = 'ok' | 'warn' | 'critical';

export interface PruneResult {
  /** Articles that actually had audio removed. */
  articles: number;
  chunks: number;
  bytes: number;
}

/** `forever` when unset or unreadable, so a broken key never deletes audio. */
export function readRetentionChoice(): RetentionChoice {
  try {
    const raw = localStorage.getItem(RETENTION_KEY);
    return CHOICES.includes(raw as RetentionChoice) ? (raw as RetentionChoice) : 'forever';
  } catch {
    return 'forever';
  }
}

/** Timestamp before which audio is expired, or null for `forever`. */
export function retentionCutoff(choice: RetentionChoice, now = Date.now()): number | null {
  if (choice === 'forever') return null;
  return now - Number(choice) * DAY_MS;
}

export function pressurePercent(usage: number, quota: number): number {
  if (!Number.isFinite(quota) || quota <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((usage / quota) * 100)));
}

export function pressureLevel(usage: number, quota: number): PressureLevel {
  const percent = pressurePercent(usage, quota);
  if (percent >= 90) return 'critical';
  if (percent >= 75) return 'warn';
  return 'ok';
}

/**
 * Delete audio for articles untouched since `olderThan`, keeping every article
 * and segment. Segments that pointed at the removed clips become approximate.
 */
export async function pruneAudioForArticles(olderThan: number): Promise<PruneResult> {
  const articles = (await db.articles.toArray()).filter((a) => a.updatedAt < olderThan);
  let removedArticles = 0;
  let removedChunks = 0;
  let removedBytes = 0;

  for (const article of articles) {
    const rows = await getChunks(article.id);
    if (rows.length === 0) continue;

    const files = await db.audioFiles.bulkGet(rows.map((row) => row.blobKey));
    removedBytes += files.reduce((sum, file) => sum + (file?.blob.size ?? 0), 0);

    await db.transaction(
      'rw',
      db.audioChunks,
      db.audioFiles,
      db.transcriptSegments,
      async () => {
        await db.audioChunks.bulkDelete(rows.map((row) => row.id));
        await db.audioFiles.bulkDelete(rows.map((row) => row.blobKey));
        const segments = await db.transcriptSegments
          .where('articleId')
          .equals(article.id)
          .toArray();
        await Promise.all(
          segments.map((segment) =>
            db.transcriptSegments.put({ ...segment, approximate: true }),
          ),
        );
      },
    );

    removedArticles++;
    removedChunks += rows.length;
  }

  return { articles: removedArticles, chunks: removedChunks, bytes: removedBytes };
}

/** Run the stored window; null means the user chose to keep audio forever. */
export async function pruneExpiredAudio(now = Date.now()): Promise<PruneResult | null> {
  const cutoff = retentionCutoff(readRetentionChoice(), now);
  if (cutoff === null) return null;
  return pruneAudioForArticles(cutoff);
}
