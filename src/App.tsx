import { useEffect, useState } from 'react';
import { useAppStore, initHistorySync } from './ui/appStore';
import { UnsupportedBrowserNotice } from './ui/UnsupportedBrowserNotice';
import { speechSupported } from './ui/speechSupport';
import { HelpDialog } from './ui/HelpDialog';
import { SettingsDialog } from './ui/SettingsDialog';
import LibraryView from './features/library/LibraryView';
import RecordingView from './features/recording/RecordingView';
import EditorView from './features/editor/EditorView';
import './features/views.css';

function readStoredTheme(): 'dark' | 'light' {
  try {
    return localStorage.getItem('nakili-theme') === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function writeStoredTheme(theme: 'dark' | 'light'): void {
  try {
    localStorage.setItem('nakili-theme', theme);
  } catch {
    /* storage unavailable (private mode / tests) */
  }
}

function AppShell({ children }: { children: React.ReactNode }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const navigate = useAppStore((s) => s.navigate);
  const view = useAppStore((s) => s.view);
  const [theme, setTheme] = useState<'dark' | 'light'>(
    () => (document.documentElement.getAttribute('data-theme') as 'dark' | 'light') || readStoredTheme(),
  );

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    writeStoredTheme(next);
    setTheme(next);
  };

  return (
    <div className="app-frame">
      <header className="app-header">
        <button className="brand" onClick={() => navigate('home')} aria-label="Nakili home">
          Nakili
        </button>
        <nav className="header-nav" aria-label="Site">
          <button aria-current={view === 'home' ? 'page' : undefined} onClick={() => navigate('home')}>
            Recordings
          </button>
          <button onClick={() => setSettingsOpen(true)}>Settings</button>
          <button onClick={() => setHelpOpen(true)}>Help</button>
        </nav>
      </header>

      {children}

      <footer className="app-footer">
        <span>Local-first dictation. Nothing leaves your browser.</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
          <a href="mailto:culturedrabbit@gmail.com">Contact</a>
          <button
            className="ghost"
            onClick={toggleTheme}
            aria-label={`Theme: ${theme}. Activate to switch`}
            style={{ minHeight: 32, padding: '4px 12px' }}
          >
            Theme: {theme}
          </button>
          <button className="link-button" onClick={() => setHelpOpen(true)}>Help</button>
        </span>
      </footer>

      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
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
