import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from '../App';
import { useToastStore } from './toastStore';
import { useAppStore } from './appStore';

describe('app shell', () => {
  beforeEach(() => {
    useAppStore.setState({ view: 'home', activeArticleId: null });
    useToastStore.setState({ toasts: [] });
  });

  it('shows home view by default', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Articles' })).toBeInTheDocument();
  });

  it('shows unsupported-browser notice when Web Speech API is missing', async () => {
    vi.resetModules();
    vi.doMock('./speechSupport', () => ({ speechSupported: false }));
    const { default: AppReloaded } = await import('../App');
    render(<AppReloaded />);
    expect(screen.getByText(/requires Chrome or Edge/i)).toBeInTheDocument();
    vi.doUnmock('./speechSupport');
  });

  it('renders and auto-dismisses toasts after 4 s', async () => {
    vi.useFakeTimers();
    render(<App />);
    useToastStore.getState().showToast('Saved');
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('Saved');
    vi.advanceTimersByTime(4100);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    vi.useRealTimers();
  });

  it('navigates to record view on New article (placeholder creates id)', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /new article/i }));
    expect(useAppStore.getState().view).toBe('record');
  });
});
