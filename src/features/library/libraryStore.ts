import { create } from 'zustand';
import type { Article, AudioChunk } from '../../core/models';
import * as repo from '../../core/db/repositories';

interface LibraryState {
  articles: Article[];
  loaded: boolean;
  refresh: () => Promise<void>;
  createArticle: () => Promise<string>;
  renameArticle: (id: string, title: string) => Promise<void>;
  duplicateArticle: (id: string) => Promise<string>;
  deleteArticle: (id: string) => Promise<void>;
}

export function formatDuration(totalSec: number): string {
  const total = Math.round(totalSec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  articles: [],
  loaded: false,

  refresh: async () => {
    set({ articles: await repo.listArticles(), loaded: true });
  },

  createArticle: async () => {
    const id = crypto.randomUUID();
    const now = Date.now();
    await repo.putArticle({
      id, title: 'Untitled recording',
      createdAt: now, updatedAt: now,
      durationSec: 0, transcriptText: '',
    });
    await get().refresh();
    return id;
  },

  renameArticle: async (id, title) => {
    const a = await repo.getArticle(id);
    if (!a) return;
    await repo.putArticle({ ...a, title, updatedAt: Date.now() });
    await get().refresh();
  },

  duplicateArticle: async (id) => {
    const src = await repo.getArticle(id);
    if (!src) throw new Error(`article not found: ${id}`);
    const newId = crypto.randomUUID();
    const now = Date.now();
    await repo.putArticle({
      ...src, id: newId, title: `Copy of ${src.title}`,
      createdAt: now, updatedAt: now,
    });

    // Copy audio chunks + blobs verbatim.
    const srcChunks = await repo.getChunks(id);
    if (srcChunks.length > 0) {
      const blobs = await Promise.all(srcChunks.map((c) => repo.getAudioBlob(c.blobKey)));
      const newKeys = await repo.saveSessionAudio(newId, blobs.map((b) => b!));
      const copied: AudioChunk[] = (await repo.getChunks(newId)).map((c, i) => ({
        ...c, blobKey: newKeys[i],
      }));
      const { db } = await import('../../core/db/db');
      await db.audioChunks.bulkPut(copied);
    }

    // Copy segments verbatim under the new article.
    const segs = await repo.getSegments(id);
    if (segs.length > 0) {
      await repo.putSegments(segs.map((s) => ({ ...s, id: crypto.randomUUID(), articleId: newId })));
    }

    await get().refresh();
    return newId;
  },

  deleteArticle: async (id) => {
    await repo.deleteArticleCascade(id);
    await get().refresh();
  },
}));
