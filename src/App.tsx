import { useAppStore } from './ui/appStore';
import { ToastHost } from './ui/Toast';
import { UnsupportedBrowserNotice } from './ui/UnsupportedBrowserNotice';
import { speechSupported } from './ui/speechSupport';
import LibraryView from './features/library/LibraryView';
import RecordingView from './features/recording/RecordingView';
import EditorView from './features/editor/EditorView';
import './features/views.css';

export default function App() {
  const view = useAppStore((s) => s.view);

  if (!speechSupported) {
    return (
      <>
        <UnsupportedBrowserNotice />
        <ToastHost />
      </>
    );
  }

  return (
    <>
      {view === 'home' && <LibraryView />}
      {view === 'record' && <RecordingView />}
      {view === 'editor' && <EditorView />}
      <ToastHost />
    </>
  );
}
