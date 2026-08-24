import { useAppStore } from '../../ui/appStore';

export default function LibraryView() {
  const navigate = useAppStore((s) => s.navigate);
  return (
    <main className="view">
      <div className="view-header">
        <h1>Articles</h1>
        <button className="primary" onClick={() => navigate('record')}>New article</button>
      </div>
    </main>
  );
}
