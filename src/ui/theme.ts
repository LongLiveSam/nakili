import { create } from 'zustand';

export const SKINS = ['paper', 'primer', 'neutral', 'nothing'] as const;
export type Skin = (typeof SKINS)[number];
export type Mode = 'light' | 'dark';

export const SKIN_LABELS: Record<Skin, string> = {
  paper: 'Paper',
  primer: 'Primer',
  neutral: 'Neutral',
  nothing: 'Nothing',
};

interface ThemeState {
  skin: Skin;
  mode: Mode;
  setSkin: (s: Skin) => void;
  setMode: (m: Mode) => void;
}

function readLegacyMode(): Mode | null {
  try {
    const legacy = localStorage.getItem('nakili-theme');
    if (legacy === 'light' || legacy === 'dark') return legacy;
  } catch { /* ignore */ }
  return null;
}

function readStored(): { skin: Skin; mode: Mode } {
  try {
    const skin = localStorage.getItem('nakili-skin') as Skin | null;
    const mode = localStorage.getItem('nakili-mode') as Mode | null;
    return {
      skin: skin && SKINS.includes(skin) ? skin : 'paper',
      mode: mode === 'light' || mode === 'dark' ? mode : readLegacyMode() ?? 'dark',
    };
  } catch {
    return { skin: 'paper', mode: 'dark' };
  }
}

function applyToDom(skin: Skin, mode: Mode): void {
  document.documentElement.setAttribute('data-skin', skin);
  document.documentElement.setAttribute('data-mode', mode);
}

/** Apply stored theme before first paint; call once from main.tsx. */
export function initTheme(): void {
  const { skin, mode } = readStored();
  applyToDom(skin, mode);
  useThemeStore.setState({ skin, mode });
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  skin: 'paper',
  mode: 'dark',
  setSkin: (skin) => {
    applyToDom(skin, get().mode);
    try { localStorage.setItem('nakili-skin', skin); } catch { /* ignore */ }
    set({ skin });
  },
  setMode: (mode) => {
    applyToDom(get().skin, mode);
    try { localStorage.setItem('nakili-mode', mode); localStorage.removeItem('nakili-theme'); } catch { /* ignore */ }
    set({ mode });
  },
}));
