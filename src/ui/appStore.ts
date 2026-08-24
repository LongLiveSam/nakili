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
  navigate: (view, articleId = null) => set({ view, activeArticleId: articleId }),
}));
