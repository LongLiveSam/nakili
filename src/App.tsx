import { useEffect, useState } from 'react';
import { useAppStore, initHistorySync } from './ui/appStore';
import { useThemeStore, MODE_LABELS } from './ui/theme';
import { UnsupportedBrowserNotice } from './ui/UnsupportedBrowserNotice';
import { speechSupported } from './ui/speechSupport';
import { HelpDialog } from './ui/HelpDialog';
import { SettingsDialog } from './ui/SettingsDialog';
import LibraryView from './features/library/LibraryView';
import LandingView from './features/library/LandingView';
import RecordingView from './features/recording/RecordingView';
import EditorView from './features/editor/EditorView';
import { APP_VERSION, versionLabel } from './version';

function AppShell({ children }: { children: React.ReactNode }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const navigate = useAppStore((s) => s.navigate);
  const view = useAppStore((s) => s.view);
  const mode = useThemeStore((s) => s.mode);
  const cycleMode = useThemeStore((s) => s.cycleMode);

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="app-header">
        <div className="wrap shell-inner">
          <button className="brand" onClick={() => navigate('home')} aria-label="Nakili home">
            Nakili
          </button>
          <nav className="header-nav" aria-label="Site">
            <button aria-current={view === 'home' ? 'page' : undefined} onClick={() => navigate('home')}>
              Home
            </button>
            <button
              aria-current={view !== 'home' ? 'page' : undefined}
              onClick={() => navigate('library')}
            >
              Recordings
            </button>
            <button onClick={() => setSettingsOpen(true)}>Settings</button>
            <button onClick={() => setHelpOpen(true)}>Help</button>
          </nav>
        </div>
      </header>

      {children}

      <footer className="app-footer">
        <div className="wrap shell-inner">
          <span>Local-first dictation. Nothing leaves your browser.</span>
          <span className="footer-controls">
            <span className="app-version" title={`Nakili ${APP_VERSION}`}>
              {versionLabel()}
            </span>
            <a
              href={`mailto:culturedrabbit@gmail.com?subject=${encodeURIComponent('Nakili feedback')}&body=${encodeURIComponent(`\n\n—\n${navigator.userAgent}`)}`}
            >
              Contact
            </a>
            <button
              className="ghost"
              onClick={cycleMode}
              aria-label={`Color mode: ${MODE_LABELS[mode]}. Activate to cycle`}
            >
              Mode: {MODE_LABELS[mode]}
            </button>
          </span>
        </div>
      </footer>

      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default function App() {
  const view = useAppStore((s) => s.view);

  useEffect(() => initHistorySync(), []);

  // Ask the browser to exempt our local data from automatic eviction.
  useEffect(() => { void navigator.storage?.persist?.().catch(() => {}); }, []);

  if (!speechSupported) {
    return (
      <AppShell>
        <UnsupportedBrowserNotice />
      </AppShell>
    );
  }

  return (
    <AppShell>
      {view === 'home' && <LandingView />}
      {view === 'library' && <LibraryView />}
      {view === 'record' && <RecordingView />}
      {view === 'editor' && <EditorView />}
    </AppShell>
  );
}
