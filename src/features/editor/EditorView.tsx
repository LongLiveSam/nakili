import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from './editorStore';
import { useAppStore } from '../../ui/appStore';
import { exportTranscript } from '../../core/services/ExportService';
import { getChunks, putArticle, deleteClip, getAudioBlob } from '../../core/db/repositories';
import { ClipSidebar, type ClipRowData } from './ClipSidebar';
import { ConfirmDialog } from '../library/ConfirmDialog';
import { usePlaybackStore } from '../playback/playbackStore';
import { ClipPlayerProvider } from '../playback/ClipPlayerProvider';
import { PlayHighlightOverlay } from './PlayHighlightOverlay';
import { TutorialOverlay } from '../../ui/TutorialOverlay';
import { ArrowLeftIcon } from '../../ui/icons';
import { findFillers, smartTypography } from '../../core/services/formatting';
import { runUserScript } from '../../core/services/userScript';
import { loadTransformScript } from '../../core/services/pipelineSettings';

import { transcribeClipLocally, isWhisperBetaEnabled } from '../../core/services/localWhisper';

function loadFontSize(): number {
  try {
    const v = Number(localStorage.getItem('nakili-fontsize'));
    return v >= 14 && v <= 24 ? v : 18;
  } catch {
    return 18;
  }
}

function loadVocabTerms(): string[] {
  try {
    return (localStorage.getItem('nakili-vocab') ?? '')
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean);
  } catch {
    return [];
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
  const [reading, setReading] = useState(false);
  const [scriptStatus, setScriptStatus] = useState<string | null>(null);
  const [sweep, setSweep] = useState<{ ranges: Array<{ start: number; end: number }>; i: number } | null>(null);
  const whisperBeta = isWhisperBetaEnabled();
  const [tutorialOpen, setTutorialOpen] = useState(() => {
    try {
      return localStorage.getItem('nakili-tutorial-done') === null;
    } catch {
      return false;
    }
  });

  const finishTutorial = () => {
    setTutorialOpen(false);
    try { localStorage.setItem('nakili-tutorial-done', '1'); } catch { /* ignore */ }
  };

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

  const handleWhisperClip = async (index: number): Promise<string> => {
    const rows = await getChunks(articleId);
    const chunk = rows.find((c) => c.index === index);
    if (!chunk) throw new Error('clip missing');
    const blob = await getAudioBlob(chunk.blobKey);
    if (!blob) throw new Error('audio missing');
    return transcribeClipLocally(blob);
  };

  const handleApplyWhisper = (index: number, suggestion: string) => {
    const st = useEditorStore.getState();
    const candidates = st.segments.filter((s) => s.audioChunkIndex === index);
    if (candidates.length === 0 || !st.article) return;
    const target = candidates.reduce((a, b) =>
      b.endCharOffset - b.startCharOffset > a.endCharOffset - a.startCharOffset ? b : a,
    );
    const cur = st.article.transcriptText;
    const next = cur.slice(0, target.startCharOffset) + suggestion + cur.slice(target.endCharOffset + 1);
    setText(next);
  };

  // Second pass: re-transcribe every clip whose live recognition was flagged approximate.
  const [batchStatus, setBatchStatus] = useState<string | null>(null);
  const flaggedIndexes = Array.from(
    new Set(useEditorStore.getState().segments.filter((s) => s.approximate).map((s) => s.audioChunkIndex)),
  ).sort((a, b) => a - b);

  const fixFlaggedClips = async () => {
    if (!whisperBeta || flaggedIndexes.length === 0) return;
    for (let i = 0; i < flaggedIndexes.length; i++) {
      const idx = flaggedIndexes[i];
      setBatchStatus(`[RE-TRANSCRIBING CLIP ${idx + 1} · ${i + 1}/${flaggedIndexes.length}]`);
      try {
        const suggestion = await handleWhisperClip(idx);
        if (suggestion) handleApplyWhisper(idx, suggestion);
      } catch {
        setBatchStatus(`[ERROR: CLIP ${idx + 1} FAILED — SKIPPING]`);
      }
    }
    setBatchStatus('[SECOND PASS COMPLETE]');
    setTimeout(() => setBatchStatus(null), 4000);
  };

  // --- Writing tools -------------------------------------------------------
  const text = article?.transcriptText ?? '';
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const readMin = Math.max(1, Math.round(words / 200));
  const fillerCount = findFillers(text).length;

  const selectRange = (start: number, end: number) => {
    const ta = taRef.current;
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(start, end);
    setCursor(start);
  };

  const cycleFillers = () => {
    const hits = findFillers(text);
    if (hits.length === 0) { setSweep(null); return; }
    const i = sweep ? (sweep.i + 1) % hits.length : 0;
    setSweep({ ranges: hits.map((h) => ({ start: h.start, end: h.end })), i });
    selectRange(hits[i].start, hits[i].end);
  };

  const vocabTerms = loadVocabTerms();
  const vocabRanges = vocabTerms.flatMap((term) => {
    const ranges: Array<{ start: number; end: number }> = [];
    const hay = text.toLowerCase();
    const needle = term.toLowerCase();
    let idx = hay.indexOf(needle);
    while (idx !== -1 && ranges.length < 50) {
      ranges.push({ start: idx, end: idx + term.length });
      idx = hay.indexOf(needle, idx + needle.length);
    }
    return ranges;
  });

  const cycleVocab = () => {
    if (vocabRanges.length === 0) { setSweep(null); return; }
    const i = sweep ? (sweep.i + 1) % vocabRanges.length : 0;
    setSweep({ ranges: vocabRanges, i });
    selectRange(vocabRanges[i].start, vocabRanges[i].end);
  };

  const runScript = async () => {
    const script = loadTransformScript();
    if (!script.trim()) {
      setScriptStatus('[NO SCRIPT — SET ONE IN SETTINGS]');
      return;
    }
    setScriptStatus('[RUNNING…]');
    const result = await runUserScript(text, script);
    if (!result.ok) {
      setScriptStatus(`[ERROR: ${result.error.toUpperCase()}]`);
      return;
    }
    setText(result.text);
    setScriptStatus(result.text === text ? '[SCRIPT RAN — NO CHANGES]' : '[SCRIPT APPLIED]');
  };

  const toggleReading = () => {    if (!('speechSynthesis' in window)) return;
    if (reading) {
      speechSynthesis.cancel();
      setReading(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text || 'Nothing to read yet.');
    u.onend = () => setReading(false);
    u.onerror = () => setReading(false);
    speechSynthesis.speak(u);
    setReading(true);
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
      <TutorialOverlay open={tutorialOpen} onDone={finishTutorial} />
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
          <div className="label" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 8 }}>
            <span>{words} words</span>
            <span>· {readMin} min read</span>
            {article.durationSec > 0 && (
              <span>· {Math.round(words / Math.max(1, article.durationSec / 60))} wpm</span>
            )}
            {fillerCount > 0 && (
              <button className="ghost" style={{ minHeight: 28, padding: '0 10px' }} onClick={cycleFillers}>
                [Fillers: {fillerCount} — review]
              </button>
            )}
            {vocabRanges.length > 0 && (
              <button className="ghost" style={{ minHeight: 28, padding: '0 10px' }} onClick={cycleVocab}>
                [Vocab hits: {vocabRanges.length} — review]
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setText(smartTypography(text))}>Smart typography</button>
            <button onClick={() => void runScript()}>Run script</button>
            <button aria-pressed={reading} onClick={toggleReading}>
              {reading ? '[Reading… stop]' : 'Read aloud'}
            </button>
            {whisperBeta && flaggedIndexes.length > 0 && (
              <button onClick={() => void fixFlaggedClips()}>
                Fix flagged clips ({flaggedIndexes.length})
              </button>
            )}
            {scriptStatus && (
              <span
                role="status"
                className={scriptStatus.startsWith('[ERROR') ? 'status-line error' : 'status-line'}
              >
                {scriptStatus}
              </span>
            )}
            {batchStatus && <span className="status-line">{batchStatus}</span>}
          </div>
          <label htmlFor="transcript" className="visually-hidden">Transcript</label>
          <div className="ta-wrap">
            {playingIndex !== null && (
              <PlayHighlightOverlay
                taRef={taRef}
                text={article.transcriptText}
                segments={useEditorStore.getState().segments}
                fontSize={fontSize}
              />
            )}
            <textarea
              id="transcript"
              ref={taRef}
              value={article.transcriptText}
              onChange={(e) => setText(e.target.value)}
              onClick={syncCursor}
              onKeyUp={syncCursor}
              onSelect={syncCursor}
              onKeyDown={handleKeyDown}
              onScroll={(e) => {
                const m = e.currentTarget.previousSibling as HTMLElement | null;
                if (m) m.scrollTop = e.currentTarget.scrollTop;
              }}
              spellCheck
              style={{ width: '100%', height: '70vh', fontSize, lineHeight: 1.6 }}
            />
          </div>
        </div>

        <ClipSidebar
          chunks={chunks}
          activeClipIndex={activeClipIndex}
          approximate={approximate}
          playingIndex={playingIndex}
          panelOpen={panelOpen}
          onTogglePlay={(index) => void toggle(index)}
          onSeek={seek}
          onDeleteClip={handleDeleteClip}
          {...(whisperBeta ? { onWhisperClip: handleWhisperClip, onApplyWhisper: handleApplyWhisper } : {})}
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
