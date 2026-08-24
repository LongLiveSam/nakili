import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import App from '../App';
import { useToastStore } from './toastStore';
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
    useToastStore.setState({ toasts: [] });
  });

  it('shows home view by default', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Recordings' })).toBeInTheDocument();
  });

  it('shows site header with brand, Recordings link and Help', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Nakili home' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Help' }).length).toBeGreaterThan(0);
  });

  it('opens the Help dialog from the header', async () => {
    render(<App />);
    await userEvent.click(screen.getAllByRole('button', { name: 'Help' })[0]);
    expect(await screen.findByText('How it works')).toBeInTheDocument();
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

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders and auto-dismisses toasts after 4 s', async () => {
    vi.useFakeTimers();
    render(<App />);
    useToastStore.getState().showToast('Saved');
    expect(document.querySelector('.toast')).toHaveTextContent('Saved');
    vi.advanceTimersByTime(4100);
    await waitFor(() => expect(document.querySelector('.toast')).toBeNull());
  });

  it('navigates to record view on New recording (placeholder creates id)', async () => {
    render(<App />);
    const buttons = await screen.findAllByRole('button', { name: /new recording/i });
    await userEvent.click(buttons[0]);
    await waitFor(() => expect(useAppStore.getState().view).toBe('record'));
    expect(useAppStore.getState().activeArticleId).toBeTruthy();
  });
});
