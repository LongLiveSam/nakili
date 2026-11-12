import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from '../App';
import { useAppStore } from './appStore';
import { useLibraryStore } from '../features/library/libraryStore';

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
    document.documentElement.setAttribute('data-skin', 'paper');
    document.documentElement.setAttribute('data-mode', 'dark');
  });

  it('shows the landing page on first visit', async () => {
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: /nakili/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/edit the words in place/i)).toBeInTheDocument();
    expect(screen.getByText('Live transcript while you speak')).toBeInTheDocument();
  });

  it('shows site header with brand, Recordings link and Help', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Nakili home' })).toBeInTheDocument();
    // One Help entry (header); the footer repeats only theme controls.
    expect(screen.getByRole('button', { name: 'Help' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /skip to content/i })).toHaveAttribute('href', '#main');
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

  it('cycles design skins and toggles light/dark mode', async () => {
    render(<App />);
    document.documentElement.setAttribute('data-skin', 'paper');
    document.documentElement.setAttribute('data-mode', 'dark');

    await userEvent.click(screen.getByRole('button', { name: /design: paper/i }));
    expect(document.documentElement.getAttribute('data-skin')).toBe('primer');

    await userEvent.click(screen.getByRole('button', { name: /mode: dark/i }));
    expect(document.documentElement.getAttribute('data-mode')).toBe('light');
    expect(screen.getByRole('button', { name: /mode: light/i })).toBeInTheDocument();
  });

  it('navigates to record view from the landing CTA', async () => {
    render(<App />);
    const ctas = await screen.findAllByRole('button', { name: /start dictating/i });
    await userEvent.click(ctas[0]);
    await waitFor(() => expect(useAppStore.getState().view).toBe('record'));
    expect(useAppStore.getState().activeArticleId).toBeTruthy();
  });
});
