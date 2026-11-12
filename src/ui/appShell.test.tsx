import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from '../App';
import { useAppStore } from './appStore';
import { useLibraryStore } from '../features/library/libraryStore';
import { useThemeStore } from './theme';
import { APP_VERSION } from '../version';

describe('app shell', () => {
  beforeEach(() => {
    if (!HTMLDialogElement.prototype.showModal) {
      HTMLDialogElement.prototype.showModal = function showModal() {
        this.open = true;
      };
      HTMLDialogElement.prototype.close = function close() {
        this.open = false;
      };
    }
    useAppStore.setState({ view: 'home', activeArticleId: null });
    // Empty, already-loaded library: the landing renders on first paint instead
    // of waiting on an IndexedDB round trip (which made this suite timing-flaky).
    useLibraryStore.setState({ articles: [], loaded: true });
    document.documentElement.setAttribute('data-mode', 'dark');
  });

  it('shows the landing page on first visit', async () => {
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: /nakili/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/edit the words in place/i)).toBeInTheDocument();
    expect(screen.getByText('Live transcription')).toBeInTheDocument();
  });

  it('shows site header with brand, Recordings link and Help', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Nakili home' })).toBeInTheDocument();
    // One Help entry (header); the footer repeats only theme controls.
    expect(screen.getByRole('button', { name: 'Help' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /skip to content/i })).toHaveAttribute('href', '#main');
  });

  it('shows the app version in the footer', () => {
    render(<App />);
    expect(screen.getByText(`v${APP_VERSION}`)).toBeInTheDocument();
  });

  it('opens the Help dialog from the header', async () => {
    render(<App />);
    await userEvent.click(screen.getAllByRole('button', { name: 'Help' })[0]);
    expect(await screen.findByText('Fixing mistakes with clips')).toBeInTheDocument();
    expect(screen.getByText(/Nothing leaves your browser/i)).toBeInTheDocument();
  });

  it('shows unsupported-browser notice when Web Speech API is missing', async () => {
    vi.resetModules();
    vi.doMock('./speechSupport', () => ({ speechSupported: false }));
    const { default: AppReloaded } = await import('../App');
    render(<AppReloaded />);
    expect(screen.getByText(/requires Chrome or Edge/i)).toBeInTheDocument();
    vi.doUnmock('./speechSupport');
  });

  it('cycles color mode through system, light and dark', async () => {
    render(<App />);
    useThemeStore.setState({ mode: 'system' });
    document.documentElement.setAttribute('data-mode', 'light');

    await userEvent.click(screen.getByRole('button', { name: /color mode: system/i }));
    expect(useThemeStore.getState().mode).toBe('light');
    expect(document.documentElement.getAttribute('data-mode')).toBe('light');

    await userEvent.click(screen.getByRole('button', { name: /color mode: light/i }));
    expect(useThemeStore.getState().mode).toBe('dark');
    expect(document.documentElement.getAttribute('data-mode')).toBe('dark');
  });

  it('navigates to record view from the landing CTA', async () => {
    render(<App />);
    const ctas = await screen.findAllByRole('button', { name: /start dictating/i });
    await userEvent.click(ctas[0]);
    await waitFor(() => expect(useAppStore.getState().view).toBe('record'));
    expect(useAppStore.getState().activeArticleId).toBeTruthy();
  });
});
