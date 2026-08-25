import { useEffect, useRef, useState } from 'react';
import { useRecordingStore, getActiveAnalyser } from './recordingStore';
import { LevelMeter } from './LevelMeter';
import { useAppStore } from '../../ui/appStore';
import { ArrowLeftIcon } from '../../ui/icons';

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function RecordingView() {
  const status = useRecordingStore((s) => s.status);
  const elapsedSec = useRecordingStore((s) => s.elapsedSec);
  const interimText = useRecordingStore((s) => s.interimText);
  const finals = useRecordingStore((s) => s.finals);
  const errorMessage = useRecordingStore((s) => s.errorMessage);
  const start = useRecordingStore((s) => s.start);
  const stopAndSave = useRecordingStore((s) => s.stopAndSave);
  const articleId = useAppStore((s) => s.activeArticleId)!;
  const navigate = useAppStore((s) => s.navigate);
  const startedRef = useRef(false);
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && !navigator.onLine);

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      void start();
    }
  }, [start]);

  // Dictation (Chrome server-backed speech) needs a connection.
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // Keyboard shortcut: Ctrl+Shift+D starts/stops dictation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyD') {
        e.preventDefault();
        if (useRecordingStore.getState().status === 'recording') {
          void stopAndSave(articleId);
        } else {
          void start();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [start, stopAndSave, articleId]);

  const finalText = finals.map((f) => f.text).join(' ');
  const recorderNotice = useRecordingStore((s) => s.recorderNotice);

  return (
    <main className="view">
      <div className="view-header">
        {status !== 'recording' && (
          <button aria-label="Back to recordings" onClick={() => navigate('home')}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <ArrowLeftIcon /> Recordings
            </span>
          </button>
        )}
        <span className="label" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          {status === 'recording' ? (
            <>
              <span className="rec-dot" aria-hidden="true" />
              Recording
            </>
          ) : (
            'Ready'
          )}
        </span>
        {status === 'recording' ? (
          <button className="primary" onClick={() => void stopAndSave(articleId)}>
            Stop
          </button>
        ) : (
          <button className="primary" onClick={() => void start()}>
            Start recording
          </button>
        )}
      </div>

      <p className="timer" style={{ margin: 'var(--space-xl) 0', textAlign: 'center' }} aria-hidden="true">
        {formatClock(elapsedSec)}
      </p>
      <span className="visually-hidden">{`Elapsed ${formatClock(elapsedSec)}`}</span>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-lg)' }}>
        <LevelMeter getAnalyser={getActiveAnalyser} />
      </div>

      {errorMessage && (
        <p role="alert" className="status-line error" style={{ textAlign: 'center' }}>{errorMessage}</p>
      )}
      {recorderNotice && (
        <p className="status-line" style={{ textAlign: 'center' }}>{recorderNotice}</p>
      )}
      {offline && (
        <p role="status" className="status-line error" style={{ textAlign: 'center' }}>
          [OFFLINE — SPEECH RECOGNITION NEEDS A CONNECTION; AUDIO STILL RECORDS]
        </p>
      )}

      <section
        aria-label="Live transcript"
        aria-live="polite"
        style={{
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 'var(--space-md)',
          minHeight: 300,
          whiteSpace: 'pre-wrap',
          background: 'var(--surface)',
        }}
      >
        <p style={{ margin: 0 }}>
          {finalText}{finalText && ' '}
          <span style={{ color: 'var(--text-secondary)' }}>{interimText}</span>
        </p>
      </section>
    </main>
  );
}
