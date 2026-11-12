import { useEffect, useState } from 'react';
import { useAppStore, initHistorySync } from './ui/appStore';
import { useThemeStore, SKINS, SKIN_LABELS, type Skin } from './ui/theme';
import { UnsupportedBrowserNotice } from './ui/UnsupportedBrowserNotice';
import { speechSupported } from './ui/speechSupport';
import { HelpDialog } from './ui/HelpDialog';
import { SettingsDialog } from './ui/SettingsDialog';
import LibraryView from './features/library/LibraryView';
import RecordingView from './features/recording/RecordingView';
import EditorView from './features/editor/EditorView';

function AppShell({ children }: { children: React.ReactNode }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const navigate = useAppStore((s) => s.navigate);
  const view = useAppStore((s) => s.view);
  const skin = useThemeStore((s) => s.skin);
  const mode = useThemeStore((s) => s.mode);
  const setSkin = useThemeStore((s) => s.setSkin);
  const setMode = useThemeStore((s) => s.setMode);

  const cycleSkin = () => {
    const i = SKINS.indexOf(skin);
    setSkin(SKINS[(i + 1) % SKINS.length] as Skin);
  };

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main">Skip to content</a>
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
        <span className="footer-controls">
          <a
            href={`mailto:culturedrabbit@gmail.com?subject=${encodeURIComponent('Nakili feedback')}&body=${encodeURIComponent(`\n\n—\n${navigator.userAgent}`)}`}
          >
            Contact
          </a>
          <button
            className="ghost"
            onClick={cycleSkin}
            aria-label={`Design: ${SKIN_LABELS[skin]}. Activate to cycle`}
          >
            Design: {SKIN_LABELS[skin]}
          </button>
          <button
            className="ghost"
            onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
            aria-label={`Mode: ${mode}. Activate to switch`}
          >
            Mode: {mode}
          </button>
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
      {view === 'home' && <LibraryView />}
      {view === 'record' && <RecordingView />}
      {view === 'editor' && <EditorView />}
    </AppShell>
  );
}
