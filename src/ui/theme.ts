import { create } from 'zustand';

export const MODES = ['system', 'light', 'dark'] as const;
export type Mode = (typeof MODES)[number];

export const MODE_LABELS: Record<Mode, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

interface ThemeState {
  mode: Mode;
  setMode: (m: Mode) => void;
  cycleMode: () => void;
}

function readLegacyMode(): Mode | null {
  try {
    const legacy = localStorage.getItem('nakili-theme');
    if (legacy === 'light' || legacy === 'dark') return legacy;
  } catch { /* ignore */ }
  return null;
}

function readStored(): Mode {
  try {
    const mode = localStorage.getItem('nakili-mode') as Mode | null;
    if (mode && MODES.includes(mode)) return mode;
    return readLegacyMode() ?? 'system';
  } catch {
    return 'system';
  }
}

function systemPrefersDark(): boolean {
  try {
    return typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export function resolveMode(mode: Mode): 'light' | 'dark' {
  if (mode === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return mode;
}

function applyToDom(mode: Mode): void {
  const resolved = resolveMode(mode);
  document.documentElement.setAttribute('data-mode', resolved);
  document.documentElement.setAttribute('data-mode-preference', mode);
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', resolved === 'dark' ? '#12100e' : '#eef0ec');
}

/** Apply stored theme before first paint; call once from main.tsx. */
export function initTheme(): void {
  const mode = readStored();
  applyToDom(mode);
  useThemeStore.setState({ mode });
  try {
    if (typeof window.matchMedia === 'function') {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (useThemeStore.getState().mode === 'system') applyToDom('system');
      });
    }
  } catch {
    /* older browsers: the initial resolution still applies */
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'system',
  setMode: (mode) => {
    applyToDom(mode);
    try {
      localStorage.setItem('nakili-mode', mode);
      localStorage.removeItem('nakili-theme');
    } catch { /* ignore */ }
    set({ mode });
  },
  cycleMode: () => {
    const i = MODES.indexOf(get().mode);
    get().setMode(MODES[(i + 1) % MODES.length]);
  },
}));
