import { useEffect, useRef } from 'react';
import { useRecordingStore } from './recordingStore';
import { useAppStore } from '../../ui/appStore';

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

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      void start();
    }
  }, [start]);

  const finalText = finals.map((f) => f.text).join(' ');

  return (
    <main className="view">
      <div className="view-header">
        {status !== 'recording' && (
          <button aria-label="Back to recordings" onClick={() => navigate('home')}>
            ← Recordings
          </button>
        )}
        <h1>
          {status === 'recording' ? '● Recording · ' : 'Ready · '}
          <time>{formatClock(elapsedSec)}</time>
        </h1>
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

      {errorMessage && (
        <p role="alert" style={{ color: 'var(--danger)' }}>{errorMessage}</p>
      )}

      <section
        aria-label="Live transcript"
        aria-live="polite"
        style={{
          border: '1px solid var(--border)', borderRadius: 'var(--radius)',
          padding: 16, minHeight: 300, whiteSpace: 'pre-wrap',
        }}
      >
        <p style={{ margin: 0 }}>
          {finalText}{finalText && ' '}
          <span style={{ color: 'var(--fg-subtle)' }}>{interimText}</span>
        </p>
      </section>
    </main>
  );
}
