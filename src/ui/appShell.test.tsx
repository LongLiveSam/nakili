import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from '../App';
import { useAppStore } from './appStore';

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
    document.documentElement.removeAttribute('data-theme');
  });

  it('shows the landing page on first visit', async () => {
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: 'Nakili' }, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Turn your voice into polished articles/)).toBeInTheDocument();
    expect(screen.getByText('Speak naturally')).toBeInTheDocument();
  });

  it('shows site header with brand, Recordings link and Help', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Nakili home' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Help' }).length).toBeGreaterThan(0);
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

  it('toggles dark and light themes', async () => {
    render(<App />);
    const before = document.documentElement.getAttribute('data-theme') ?? 'dark';
    const toggle = screen.getByRole('button', { name: new RegExp(`theme: ${before}`, 'i') });
    await userEvent.click(toggle);
    expect(document.documentElement.getAttribute('data-theme')).not.toBe(before);
    expect(screen.getByRole('button', { name: new RegExp(`theme: (?!${before})`, 'i') })).toBeInTheDocument();
  });

  it('navigates to record view from the landing CTA', async () => {
    render(<App />);
    const cta = await screen.findByRole('button', { name: /start dictating/i });
    await userEvent.click(cta);
    await waitFor(() => expect(useAppStore.getState().view).toBe('record'));
    expect(useAppStore.getState().activeArticleId).toBeTruthy();
  });
});
