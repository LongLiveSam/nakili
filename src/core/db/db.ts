import Dexie, { type Table } from 'dexie';
import type { Article, AudioChunk, TranscriptSegment } from '../models';

export interface AudioFileRow { key: string; blob: Blob }

export class ScribeDB extends Dexie {
  articles!: Table<Article, string>;
  audioChunks!: Table<AudioChunk, string>;
  transcriptSegments!: Table<TranscriptSegment, string>;
  audioFiles!: Table<AudioFileRow, string>;

  constructor(name = 'dictation-scribe') {
    super(name);
    this.version(1).stores({
      articles: 'id',
      audioChunks: 'id, [articleId+index]',
      transcriptSegments: 'id, [articleId+startCharOffset]',
      audioFiles: 'key',
    });
  }
}

export const db = new ScribeDB();
