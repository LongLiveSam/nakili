import { useState } from 'react';
import { useAppStore } from '../../ui/appStore';
import { useLibraryStore } from './libraryStore';
import { Landing } from './Landing';

/** The welcome page. Home is always this surface, not the recordings list. */
export default function LandingView() {
  const navigate = useAppStore((s) => s.navigate);
  const createArticle = useLibraryStore((s) => s.createArticle);
  const [status, setStatus] = useState<string | null>(null);

  const start = async () => {
    const id = await createArticle();
    navigate('record', id);
  };

  return (
    <main className="view" id="main">
      <Landing
        onStart={() => void start()}
        onViewRecordings={() => navigate('library')}
        onImported={(id) => navigate('editor', id)}
        onStatus={setStatus}
        status={status}
      />
    </main>
  );
}
