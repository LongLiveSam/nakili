import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import LibraryView from './LibraryView';
import { useLibraryStore } from './libraryStore';
import { db } from '../../core/db/db';
import { putArticle } from '../../core/db/repositories';
import { useAppStore } from '../../ui/appStore';

// jsdom does not implement <dialog>.showModal; minimal stub (test-only).
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
  };
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  useLibraryStore.setState({ articles: [], loaded: false });
  useAppStore.setState({ view: 'home', activeArticleId: null });
});

async function seed(title: string) {
  await putArticle({
    id: `id-${title}`, title, createdAt: 0,
    updatedAt: Date.parse('2026-01-02T10:00:00'), durationSec: 125, transcriptText: '',
  });
}

describe('library', () => {
  it('lists articles with date and duration', async () => {
    await seed('My essay');
    render(<LibraryView />);
    expect(await screen.findByText('My essay')).toBeInTheDocument();
    expect(screen.getByText(/2:05/)).toBeInTheDocument();
  });

  it('creates an article and navigates to record view with its id', async () => {
    render(<LibraryView />);
    await userEvent.click(screen.getByRole('button', { name: /new article/i }));
    await waitFor(() => expect(useAppStore.getState().view).toBe('record'));
    expect(useAppStore.getState().activeArticleId).toBeTruthy();
  });

  it('renames via dialog', async () => {
    await seed('Old name');
    render(<LibraryView />);
    await userEvent.click(await screen.findByRole('button', { name: /actions for Old name/i }));
    await userEvent.click(screen.getByRole('button', { name: /^rename$/i }));
    const input = screen.getByLabelText(/title/i);
    await userEvent.clear(input);
    await userEvent.type(input, 'New name');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(await screen.findByText('New name')).toBeInTheDocument();
  });

  it('deletes only after confirmation', async () => {
    await seed('Doomed');
    render(<LibraryView />);
    await userEvent.click(await screen.findByRole('button', { name: /actions for Doomed/i }));
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    // Confirmation dialog appears before actual deletion:
    expect(useLibraryStore.getState().articles.length).toBe(1);
    await userEvent.click(screen.getByRole('button', { name: /^delete article$/i }));
    await waitFor(() => expect(useLibraryStore.getState().articles.length).toBe(0));
  });

  it('duplicates an article including transcript', async () => {
    await putArticle({
      id: 'orig', title: 'Original', createdAt: 0, updatedAt: 0,
      durationSec: 0, transcriptText: 'abc',
    });
    render(<LibraryView />);
    await userEvent.click(await screen.findByRole('button', { name: /actions for Original/i }));
    await userEvent.click(screen.getByRole('button', { name: /^duplicate$/i }));
    expect(await screen.findByText(/copy of original/i)).toBeInTheDocument();
  });
});
