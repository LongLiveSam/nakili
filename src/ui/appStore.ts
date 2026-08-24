import { create } from 'zustand';

export type View = 'home' | 'record' | 'editor';

interface AppState {
  view: View;
  activeArticleId: string | null;
  navigate: (view: View, articleId?: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: 'home',
  activeArticleId: null,
  navigate: (view, articleId = null) => {
    set({ view, activeArticleId: articleId });
    // Keep the browser back button working (UX rule: back must behave predictably).
    try {
      window.history.pushState({ view, activeArticleId: articleId }, '');
    } catch {
      /* jsdom/history unavailable */
    }
  },
}));

/** Restore the in-app view when the user presses the browser back/forward buttons. */
export function initHistorySync(): () => void {
  const onPopState = (e: PopStateEvent) => {
    const s = e.state as { view?: View; activeArticleId?: string | null } | null;
    useAppStore.setState({
      view: s?.view ?? 'home',
      activeArticleId: s?.activeArticleId ?? null,
    });
  };
  window.addEventListener('popstate', onPopState);
  try {
    window.history.replaceState({ view: useAppStore.getState().view, activeArticleId: null }, '');
  } catch {
    /* ignore */
  }
  return () => window.removeEventListener('popstate', onPopState);
}
