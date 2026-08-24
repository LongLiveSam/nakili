import { useState, useEffect } from 'react';
import { useAppStore, initHistorySync } from './ui/appStore';
import { ToastHost } from './ui/Toast';
import { UnsupportedBrowserNotice } from './ui/UnsupportedBrowserNotice';
import { speechSupported } from './ui/speechSupport';
import { HelpDialog } from './ui/HelpDialog';
import LibraryView from './features/library/LibraryView';
import RecordingView from './features/recording/RecordingView';
import EditorView from './features/editor/EditorView';
import './features/views.css';

function AppShell({ children }: { children: React.ReactNode }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const navigate = useAppStore((s) => s.navigate);

  return (
    <div className="app-frame">
      <header className="app-header">
        <button className="brand" onClick={() => navigate('home')} aria-label="Dictation Scribe home">
          Dictation Scribe
        </button>
        <nav style={{ display: 'flex', gap: 8, alignItems: 'center' }} aria-label="Site">
          <button onClick={() => navigate('home')}>Recordings</button>
          <button onClick={() => setHelpOpen(true)}>Help</button>
        </nav>
      </header>

      {children}

      <footer className="app-footer">
        <span>Dictation Scribe — private, local-first dictation. Nothing leaves your browser.</span>
        <span>
          <a href="mailto:culturedrabbit@gmail.com">Contact</a>
          {' · '}
          <button className="link-button" onClick={() => setHelpOpen(true)}>Help</button>
        </span>
      </footer>

      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <ToastHost />
    </div>
  );
}

export default function App() {
  const view = useAppStore((s) => s.view);

  useEffect(() => initHistorySync(), []);

  if (!speechSupported) {
    return (
      <AppShell>
        <UnsupportedBrowserNotice />
      </AppShell>
    );
  }

  return (
    <AppShell>
      {view === 'home' && <LibraryView />}
      {view === 'record' && <RecordingView />}
      {view === 'editor' && <EditorView />}
    </AppShell>
  );
}
