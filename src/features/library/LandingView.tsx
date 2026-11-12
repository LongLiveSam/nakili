import { useEffect, useState } from 'react';
import { useAppStore } from '../../ui/appStore';
import { useLibraryStore } from './libraryStore';
import { Landing } from './Landing';

/** The welcome page. Home is always this surface, not the recordings list. */
export default function LandingView() {
  const navigate = useAppStore((s) => s.navigate);
  const createArticle = useLibraryStore((s) => s.createArticle);
  const articles = useLibraryStore((s) => s.articles);
  const refresh = useLibraryStore((s) => s.refresh);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => { void refresh(); }, [refresh]);

  const start = async () => {
    const id = await createArticle();
    navigate('record', id);
  };

  return (
    <main className="view" id="main">
      <Landing
        recent={articles.slice(0, 3)}
        onStart={() => void start()}
        onOpen={(id) => navigate('editor', id)}
        onViewRecordings={() => navigate('library')}
        onImported={(id) => navigate('editor', id)}
        onStatus={setStatus}
        status={status}
      />
    </main>
  );
}
