import { useEffect, useState } from 'react';
import { useLibraryStore, formatDuration } from './libraryStore';
import { ConfirmDialog } from './ConfirmDialog';
import { useAppStore } from '../../ui/appStore';
import { exportTranscript, exportFullRecording } from '../../core/services/ExportService';
import { MoreVerticalIcon } from '../../ui/icons';
import type { Article } from '../../core/models';

function formatDate(ms: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(ms);
}

export default function LibraryView() {
  const articles = useLibraryStore((s) => s.articles);
  const loaded = useLibraryStore((s) => s.loaded);
  const refresh = useLibraryStore((s) => s.refresh);
  const createArticle = useLibraryStore((s) => s.createArticle);
  const renameArticle = useLibraryStore((s) => s.renameArticle);
  const duplicateArticle = useLibraryStore((s) => s.duplicateArticle);
  const deleteArticle = useLibraryStore((s) => s.deleteArticle);
  const navigate = useAppStore((s) => s.navigate);
  const [status, setStatus] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<Article | null>(null);
  const [renameText, setRenameText] = useState('');
  const [deleting, setDeleting] = useState<Article | null>(null);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), 4000);
    return () => clearTimeout(t);
  }, [status]);

  const handleNew = async () => {
    const id = await createArticle();
    navigate('record', id);
  };

  return (
    <main className="view">
      <div className="view-header">
        <h1>Recordings</h1>
        <button className="primary" onClick={() => void handleNew()}>New recording</button>
      </div>

      {status && (
        <p className={`status-line${status.startsWith('[ERROR') ? ' error' : ''}`} role={status.startsWith('[ERROR') ? 'alert' : undefined}>
          {status}
        </p>
      )}

      {!loaded ? (
        <p className="label" aria-busy="true" aria-live="polite">[LOADING RECORDINGS…]</p>
      ) : articles.length === 0 ? (
        <div className="empty-state" role="status">
          <div className="dot-block" aria-hidden="true" />
          <h2>No recordings yet</h2>
          <p>Speak, and Nakili writes it down.</p>
          <p className="label">Speak → Edit → Verify clips · Headset recommended</p>
        </div>
      ) : (
        <ul role="list" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 0 }}>
          {articles.map((a) => (
            <li
              key={a.id}
              style={{
                borderBottom: '1px solid var(--border)',
                padding: '12px 0',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <button
                style={{
                  flex: 1, textAlign: 'left', border: 'none',
                  borderRadius: 0, minHeight: 44, padding: '8px 0',
                  textTransform: 'none', letterSpacing: 0,
                  fontFamily: '"Space Grotesk", sans-serif', fontSize: 16,
                }}
                onClick={() => navigate('editor', a.id)}
              >
                <strong>{a.title}</strong>
                <br />
                <span style={{ color: 'var(--text-secondary)', fontFamily: '"Space Mono", monospace', fontSize: 12 }}>
                  {formatDate(a.updatedAt)} · {formatDuration(a.durationSec)}
                </span>
              </button>
              <button
                aria-label={`Actions for ${a.title}`}
                aria-expanded={menuFor === a.id}
                onClick={() => setMenuFor(menuFor === a.id ? null : a.id)}
              >
                <MoreVerticalIcon />
              </button>
              {menuFor === a.id && (
                <div style={{
                  border: '1px solid var(--border-visible)', borderRadius: 8,
                  background: 'var(--surface-raised)', display: 'grid',
                }}>
                  <button onClick={() => { setRenaming(a); setRenameText(a.title); setMenuFor(null); }}>
                    Rename
                  </button>
                  <button onClick={async () => { setMenuFor(null); await duplicateArticle(a.id); }}>
                    Duplicate
                  </button>
                  <button onClick={async () => { setMenuFor(null); try { await exportTranscript(a.id); setStatus('[DOWNLOADED TRANSCRIPT]'); } catch { setStatus('[ERROR: EXPORT FAILED]'); } }}>
                    Export text
                  </button>
                  <button onClick={async () => { setMenuFor(null); try { await exportFullRecording(a.id, 'mp3'); setStatus('[DOWNLOADED AUDIO · MP3]'); } catch { setStatus('[ERROR: EXPORT FAILED]'); } }}>
                    Export audio · MP3
                  </button>
                  <button onClick={async () => { setMenuFor(null); try { await exportFullRecording(a.id, 'wav'); setStatus('[DOWNLOADED AUDIO · WAV]'); } catch { setStatus('[ERROR: EXPORT FAILED]'); } }}>
                    Export audio · WAV
                  </button>
                  <button onClick={async () => { setMenuFor(null); try { await exportFullRecording(a.id, 'webm'); setStatus('[DOWNLOADED AUDIO · ORIGINAL]'); } catch { setStatus('[ERROR: EXPORT FAILED]'); } }}>
                    Export audio · Original
                  </button>
                  <button className="danger" onClick={() => { setDeleting(a); setMenuFor(null); }}>
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={renaming !== null}
        title="Rename recording"
        confirmLabel="Save"
        onCancel={() => setRenaming(null)}
        onConfirm={async () => {
          if (renaming) await renameArticle(renaming.id, renameText.trim() || renaming.title);
          setRenaming(null);
        }}
      >
        <label style={{ display: 'grid', gap: 4 }}>
          Title
          <input type="text" value={renameText} onChange={(e) => setRenameText(e.target.value)} autoFocus />
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete “${deleting?.title ?? ''}”?`}
        confirmLabel="Delete recording"
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await deleteArticle(deleting.id);
          setDeleting(null);
        }}
      >
        <p>The transcript and all audio recordings will be permanently removed.</p>
      </ConfirmDialog>
    </main>
  );
}
