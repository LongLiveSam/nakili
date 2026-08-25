import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from './editorStore';
import { useAppStore } from '../../ui/appStore';
import { exportTranscript } from '../../core/services/ExportService';
import { getChunks, putArticle, deleteClip } from '../../core/db/repositories';
import { ClipSidebar, type ClipRowData } from './ClipSidebar';
import { ConfirmDialog } from '../library/ConfirmDialog';
import { usePlaybackStore } from '../playback/playbackStore';
import { ClipPlayerProvider } from '../playback/ClipPlayerProvider';
import { ArrowLeftIcon } from '../../ui/icons';

function loadFontSize(): number {
  try {
    const v = Number(localStorage.getItem('nakili-fontsize'));
    return v >= 14 && v <= 24 ? v : 18;
  } catch {
    return 18;
  }
}

export default function EditorView() {
  const articleId = useAppStore((s) => s.activeArticleId)!;
  const navigate = useAppStore((s) => s.navigate);
  const { article, load, setText, setCursor, activeClipIndex, approximate, saved, saveError } =
    useEditorStore((s) => s);
  const playingIndex = usePlaybackStore((s) => s.playingIndex);
  const toggle = usePlaybackStore((s) => s.toggle);
  const seek = usePlaybackStore((s) => s.seek);
  const [chunks, setChunks] = useState<ClipRowData[]>([]);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [fontSize, setFontSize] = useState(loadFontSize);

  // Live-apply font-size changes made in Settings.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'nakili-fontsize') setFontSize(loadFontSize());
    };
    window.addEventListener('storage', onStorage);
    const id = window.setInterval(() => setFontSize(loadFontSize()), 1500);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!articleId) return;
    void load(articleId);
    void getChunks(articleId).then((rows) =>
      setChunks(rows.map(({ index, startTimeSec, endTimeSec }) => ({ index, startTimeSec, endTimeSec }))),
    );
  }, [articleId, load]);

  // Reliability: flush the debounced autosave when the tab hides or closes.
  useEffect(() => {
    const flush = () => { void useEditorStore.getState().flushSave(); };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const syncCursor = () => {
    const ta = taRef.current;
    if (!ta) return;
    setCursor(ta.selectionStart ?? 0);
    if (useEditorStore.getState().activeClipIndex !== null) setPanelOpen(true);
  };

  // Ctrl+Enter: paragraph break at the cursor, mapped through the normal edit pipeline.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      const ta = e.currentTarget;
      const pos = ta.selectionStart ?? 0;
      const v = ta.value;
      const next = `${v.slice(0, pos)}\n\n${v.slice(pos)}`;
      setText(next);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = pos + 2;
        syncCursor();
      });
    }
  };

  const refreshClips = () => {
    void getChunks(articleId).then((rows) =>
      setChunks(rows.map(({ index, startTimeSec, endTimeSec }) => ({ index, startTimeSec, endTimeSec }))),
    );
  };

  const handleDeleteClip = (index: number) => {
    void (async () => {
      await deleteClip(articleId, index);
      useEditorStore.setState({ approximate: true });
      refreshClips();
    })();
  };

  const handleShare = async () => {
    try {
      await exportTranscript(article!.id);
      setExportStatus('[DOWNLOADED]');
      setTimeout(() => setExportStatus(null), 4000);
    } catch {
      setExportStatus('[ERROR: EXPORT FAILED]');
    }
  };

  if (!article) {
    return <main className="view"><p className="label">[LOADING…]</p></main>;
  }

  return (
    <ClipPlayerProvider>
      <main className="view editor-layout">
        <div className="editor-main">
          <div className="view-header">
            <button aria-label="Back to recordings" onClick={() => navigate('home')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <ArrowLeftIcon /> Recordings
              </span>
            </button>
            <h1 style={{ margin: 0 }}>{article.title}</h1>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {saveError ? (
                <span role="alert" className="status-line error">[AUTOSAVE FAILED — WILL RETRY]</span>
              ) : (
                <span aria-live="polite" className="status-line success">
                  {saved ? '[SAVED]' : '[SAVING…]'}
                </span>
              )}
              {exportStatus && (
                <span className={exportStatus.startsWith('[ERROR') ? 'status-line error' : 'status-line'}>
                  {exportStatus}
                </span>
              )}
              <button onClick={() => void handleShare()}>Download</button>
              <button onClick={() => { setTitleDraft(article.title); setRenaming(true); }}>
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
            onKeyDown={handleKeyDown}
            spellCheck
            style={{ width: '100%', height: '70vh', fontSize, lineHeight: 1.6 }}
          />        </div>

        <ClipSidebar
          chunks={chunks}
          activeClipIndex={activeClipIndex}
          approximate={approximate}
          playingIndex={playingIndex}
          panelOpen={panelOpen}
          onTogglePlay={(index) => void toggle(index)}
          onSeek={seek}
          onDeleteClip={handleDeleteClip}
        />

        <button
          className="clip-panel-toggle"
          aria-expanded={panelOpen}
          onClick={() => setPanelOpen((o) => !o)}
        >
          {panelOpen ? 'Hide clips' : 'Clips'}
        </button>

        <ConfirmDialog
          open={renaming}
          title="Rename recording"
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
