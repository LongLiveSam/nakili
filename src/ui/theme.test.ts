import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MODES, resolveMode, useThemeStore } from './theme';

describe('theme', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    localStorage.clear();
    useThemeStore.setState({ mode: 'system' });
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('offers system, light and dark', () => {
    expect(MODES).toEqual(['system', 'light', 'dark']);
  });

  it('resolves system from the device preference', () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
    expect(resolveMode('system')).toBe('dark');

    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
    expect(resolveMode('system')).toBe('light');
  });

  it('keeps an explicit mode regardless of the device preference', () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
    expect(resolveMode('light')).toBe('light');
    expect(resolveMode('dark')).toBe('dark');
  });

  it('cycles system → light → dark → system and persists the choice', () => {
    useThemeStore.getState().cycleMode();
    expect(useThemeStore.getState().mode).toBe('light');
    expect(localStorage.getItem('nakili-mode')).toBe('light');

    useThemeStore.getState().cycleMode();
    expect(useThemeStore.getState().mode).toBe('dark');
    expect(document.documentElement.getAttribute('data-mode')).toBe('dark');

    useThemeStore.getState().cycleMode();
    expect(useThemeStore.getState().mode).toBe('system');
    expect(document.documentElement.getAttribute('data-mode-preference')).toBe('system');
  });
});
