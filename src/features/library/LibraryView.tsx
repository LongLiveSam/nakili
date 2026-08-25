import { useEffect, useRef, useState } from 'react';
import { useLibraryStore, formatDuration } from './libraryStore';
import { ConfirmDialog } from './ConfirmDialog';
import { useAppStore } from '../../ui/appStore';
import { exportTranscript, exportFullRecording } from '../../core/services/ExportService';
import { MoreVerticalIcon, SearchIcon } from '../../ui/icons';
import { Landing } from './Landing';
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
  const [query, setQuery] = useState('');
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<Article | null>(null);
  const [renameText, setRenameText] = useState('');
  const [deleting, setDeleting] = useState<Article | null>(null);
  const menuWrapRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!menuFor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuFor(null);
        document.getElementById(`actions-${menuFor}`)?.focus();
      }
    };
    const onPointer = (e: MouseEvent) => {
      const wrap = menuWrapRef.current;
      if (wrap && !wrap.contains(e.target as Node)) setMenuFor(null);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [menuFor]);

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

      {loaded && articles.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <SearchIcon />
          <label className="visually-hidden" htmlFor="library-search">Search recordings</label>
          <input
            id="library-search"
            type="text"
            placeholder="Search title or transcript…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>
      )}

      {!loaded ? (
        <p className="label" aria-busy="true" aria-live="polite">[LOADING RECORDINGS…]</p>
      ) : articles.length === 0 ? (
        <Landing onStart={() => void handleNew()} />
      ) : (
        <ul role="list" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 0 }}>
          {articles
            .filter((a) => {
              if (!query.trim()) return true;
              const q = query.trim().toLowerCase();
              return (
                a.title.toLowerCase().includes(q) ||
                a.transcriptText.toLowerCase().includes(q)
              );
            })
            .map((a) => (
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
              <div ref={menuFor === a.id ? menuWrapRef : undefined} style={{ display: 'inline-flex', position: 'relative' }}>
                <button
                  id={`actions-${a.id}`}
                  aria-label={`Actions for ${a.title}`}
                  aria-haspopup="menu"
                  aria-expanded={menuFor === a.id}
                  onClick={() => setMenuFor(menuFor === a.id ? null : a.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown' && menuFor !== a.id) setMenuFor(a.id);
                  }}
                >
                  <MoreVerticalIcon />
                </button>
                {menuFor === a.id && (
                  <div
                    role="menu"
                    aria-label={`${a.title} actions`}
                    onKeyDown={(e) => {
                      const buttons = Array.from(e.currentTarget.querySelectorAll('button'));
                      const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
                      if (e.key === 'ArrowDown') { e.preventDefault(); buttons[(i + 1) % buttons.length]?.focus(); }
                      if (e.key === 'ArrowUp') { e.preventDefault(); buttons[(i - 1 + buttons.length) % buttons.length]?.focus(); }
                    }}
                    style={{
                      position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 20,
                      border: '1px solid var(--border-visible)', borderRadius: 8,
                      background: 'var(--surface-raised)', display: 'grid', minWidth: 180,
                    }}
                  >
                    <button role="menuitem" onClick={() => { setRenaming(a); setRenameText(a.title); setMenuFor(null); }}>
                      Rename
                    </button>
                    <button role="menuitem" onClick={async () => { setMenuFor(null); await duplicateArticle(a.id); }}>
                      Duplicate
                    </button>
                    <button role="menuitem" onClick={async () => { setMenuFor(null); try { await exportTranscript(a.id); setStatus('[DOWNLOADED TRANSCRIPT]'); } catch { setStatus('[ERROR: EXPORT FAILED]'); } }}>
                      Export text
                    </button>
                    <button role="menuitem" onClick={async () => { setMenuFor(null); try { await exportTranscript(a.id, 'md'); setStatus('[DOWNLOADED MARKDOWN]'); } catch { setStatus('[ERROR: EXPORT FAILED]'); } }}>
                      Export Markdown
                    </button>
                    <button role="menuitem" onClick={async () => { setMenuFor(null); try { await exportFullRecording(a.id, 'mp3'); setStatus('[DOWNLOADED AUDIO · MP3]'); } catch { setStatus('[ERROR: EXPORT FAILED]'); } }}>
                      Export audio · MP3
                    </button>
                    <button role="menuitem" onClick={async () => { setMenuFor(null); try { await exportFullRecording(a.id, 'wav'); setStatus('[DOWNLOADED AUDIO · WAV]'); } catch { setStatus('[ERROR: EXPORT FAILED]'); } }}>
                      Export audio · WAV
                    </button>
                    <button role="menuitem" onClick={async () => { setMenuFor(null); try { await exportFullRecording(a.id, 'webm'); setStatus('[DOWNLOADED AUDIO · ORIGINAL]'); } catch { setStatus('[ERROR: EXPORT FAILED]'); } }}>
                      Export audio · Original
                    </button>
                    <button role="menuitem" className="danger" onClick={() => { setDeleting(a); setMenuFor(null); }}>
                      Delete
                    </button>
                  </div>
                )}
              </div>
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
