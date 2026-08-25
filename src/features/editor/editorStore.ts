import { create } from 'zustand';
import type { Article, TranscriptSegment } from '../../core/models';
import { adjustSegmentsAfterEdit, findSegmentForCursor } from '../../core/services/MappingService';
import { getArticle, putArticle, putSegments, getSegments, getChunks } from '../../core/db/repositories';

let saveTimer: ReturnType<typeof setTimeout> | null = null;

interface EditorState {
  article: Article | null;
  segments: TranscriptSegment[];
  chunkCount: number;
  saved: boolean;
  saveError: boolean;
  cursorOffset: number;
  activeClipIndex: number | null;
  approximate: boolean;
  load: (id: string) => Promise<void>;
  setText: (text: string) => void;
  setCursor: (offset: number) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  article: null,
  segments: [],
  chunkCount: 0,
  saved: true,
  saveError: false,
  cursorOffset: 0,
  activeClipIndex: null,
  approximate: false,

  load: async (id) => {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    const [article, segments, chunks] = await Promise.all([
      getArticle(id), getSegments(id), getChunks(id),
    ]);
    set({
      article, segments, chunkCount: chunks.length,
      saved: true, saveError: false,
      cursorOffset: 0, activeClipIndex: null, approximate: false,
    });
    get().setCursor(0);
  },

  setText: (text) => {
    const { article, segments } = get();
    if (!article || text === article.transcriptText) return;
    const adjusted = adjustSegmentsAfterEdit(segments, article.transcriptText, text);
    const updated: Article = { ...article, transcriptText: text, updatedAt: Date.now() };
    set({ article: updated, segments: adjusted, saved: false, saveError: false });
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void (async () => {
        const cur = get();
        if (!cur.article) return;
        try {
          await putArticle(cur.article);
          await putSegments(cur.segments);
          set({ saved: true, saveError: false });
        } catch {
          // Inline status only — no toasts in the Nothing system.
          set({ saveError: true });
        }
      })();
    }, 500);
  },

  setCursor: (offset) => {
    const mapping = findSegmentForCursor(get().segments, offset);
    set({
      cursorOffset: offset,
      activeClipIndex: mapping.segment?.audioChunkIndex ?? null,
      approximate: mapping.approximate,
    });
  },
}));
