import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from './editorStore';
import { useAppStore } from '../../ui/appStore';
import { getChunks, putArticle } from '../../core/db/repositories';
import { ClipSidebar, type ClipRowData } from './ClipSidebar';
import { ConfirmDialog } from '../library/ConfirmDialog';
import { usePlaybackStore } from '../playback/playbackStore';
import { ClipPlayerProvider } from '../playback/ClipPlayerProvider';

export default function EditorView() {
  const articleId = useAppStore((s) => s.activeArticleId)!;
  const { article, load, setText, setCursor, activeClipIndex, approximate, saved } =
    useEditorStore((s) => s);
  const { playingIndex, toggle, seek, currentTimeSec, durationSec } = usePlaybackStore((s) => s);
  const [chunks, setChunks] = useState<ClipRowData[]>([]);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  useEffect(() => {
    void load(articleId);
    void getChunks(articleId).then((rows) =>
      setChunks(rows.map(({ index, startTimeSec, endTimeSec }) => ({ index, startTimeSec, endTimeSec }))),
    );
  }, [articleId, load]);

  const syncCursor = () => {
    const ta = taRef.current;
    if (ta) setCursor(ta.selectionStart ?? 0);
  };

  if (!article) {
    return <main className="view"><p>Loading…</p></main>;
  }

  return (
    <ClipPlayerProvider>
      <main className="view editor-layout">
        <div className="editor-main">
          <div className="view-header">
            <h1>{article.title}</h1>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span aria-live="polite" style={{ color: 'var(--fg-subtle)' }}>
                {saved ? 'Saved' : 'Saving…'}
              </span>
              <button aria-label="Rename" onClick={() => { setTitleDraft(article.title); setRenaming(true); }}>
                Rename
              </button>
            </div>
          </div>
          <label htmlFor="transcript" className="visually-hidden">Transcript</label>
          <textarea
            id="transcript"
            ref={taRef}
            value={article.transcriptText}
            onChange={(e) => setText(e.target.value)}
            onClick={syncCursor}
            onKeyUp={syncCursor}
            onSelect={syncCursor}
            spellCheck
            style={{ width: '100%', height: '70vh', fontSize: 18, lineHeight: 1.6 }}
          />
        </div>

        <ClipSidebar
          chunks={chunks}
          activeClipIndex={activeClipIndex}
          approximate={approximate}
          playingIndex={playingIndex}
          progressFraction={durationSec > 0 ? currentTimeSec / durationSec : 0}
          onTogglePlay={(index) => void toggle(index)}
          onSeek={seek}
        />

        <ConfirmDialog
          open={renaming}
          title="Rename article"
          confirmLabel="Save"
          onCancel={() => setRenaming(false)}
          onConfirm={async () => {
            const t = titleDraft.trim() || article.title;
            const updated = { ...article, title: t, updatedAt: Date.now() };
            await putArticle(updated);
            useEditorStore.setState({ article: updated });
            setRenaming(false);
          }}
        >
          <label style={{ display: 'grid', gap: 4 }}>
            Title
            <input type="text" value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} autoFocus />
          </label>
        </ConfirmDialog>
      </main>
    </ClipPlayerProvider>
  );
}
