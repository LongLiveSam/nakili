import { useEffect, useState } from 'react';
import { useLibraryStore, formatDuration } from './libraryStore';
import { ConfirmDialog } from './ConfirmDialog';
import { useAppStore } from '../../ui/appStore';
import { useToastStore } from '../../ui/toastStore';
import { exportTranscript, exportFullRecording } from '../../core/services/ExportService';
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
  const showToast = useToastStore((s) => s.showToast);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<Article | null>(null);
  const [renameText, setRenameText] = useState('');
  const [deleting, setDeleting] = useState<Article | null>(null);

  useEffect(() => { void refresh(); }, [refresh]);

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

      {!loaded ? (
        <p>Loading…</p>
      ) : articles.length === 0 ? (
        <p>No recordings yet. Choose “New recording” to start dictating.</p>
      ) : (
        <ul role="list" style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
          {articles.map((a) => (
            <li
              key={a.id}
              style={{
                border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                padding: 12, display: 'flex', alignItems: 'center', gap: 12,
              }}
            >
              <button
                style={{ flex: 1, textAlign: 'left', border: 'none' }}
                onClick={() => navigate('editor', a.id)}
              >
                <strong>{a.title}</strong>
                <br />
                <span style={{ color: 'var(--fg-subtle)' }}>
                  {formatDate(a.updatedAt)} · {formatDuration(a.durationSec)}
                </span>
              </button>
              <button
                aria-label={`Actions for ${a.title}`}
                aria-expanded={menuFor === a.id}
                onClick={() => setMenuFor(menuFor === a.id ? null : a.id)}
              >
                ⋮
              </button>
              {menuFor === a.id && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'grid' }}>
                  <button onClick={() => { setRenaming(a); setRenameText(a.title); setMenuFor(null); }}>
                    Rename
                  </button>
                  <button onClick={async () => { setMenuFor(null); await duplicateArticle(a.id); }}>
                    Duplicate
                  </button>
                  <button role="menuitem" onClick={async () => { setMenuFor(null); try { await exportTranscript(a.id); } catch { showToast('Export failed'); } }}>
                    Export text
                  </button>
                  <button role="menuitem" onClick={async () => { setMenuFor(null); try { await exportFullRecording(a.id); } catch { showToast('Export failed'); } }}>
                    Export audio
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
