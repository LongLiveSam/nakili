import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import LibraryView from './LibraryView';
import { useLibraryStore, formatDuration } from './libraryStore';
import { db } from '../../core/db/db';
import {
  putArticle,
  putSegments,
  saveSessionAudio,
  getChunks,
  getSegments,
  getAudioBlob,
} from '../../core/db/repositories';
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
  useLibraryStore.setState({ articles: [], loaded: true });
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

  it('shows an empty state when there are no recordings', async () => {
    render(<LibraryView />);
    expect(await screen.findByText(/no recordings yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new recording/i })).toBeInTheDocument();
  });

  it('reports when a search has no matches', async () => {
    await seed('My essay');
    render(<LibraryView />);
    const input = await screen.findByPlaceholderText(/search title or transcript/i);
    await userEvent.type(input, 'zzzz');
    expect(screen.getByText(/no matches/i)).toBeInTheDocument();
    expect(screen.queryByText('My essay')).not.toBeInTheDocument();
  });

  it('asks for the local engine before importing audio', async () => {
    localStorage.removeItem('nakili-whisper-beta');
    await seed('My essay');
    render(<LibraryView />);
    await userEvent.click(await screen.findByRole('button', { name: /import audio/i }));
    expect(screen.getByText(/enable the local engine in settings/i)).toBeInTheDocument();
  });

  it('creates an article and navigates to record view with its id', async () => {
    render(<LibraryView />);
    await userEvent.click(await screen.findByRole('button', { name: /new recording/i }));
    await waitFor(() => expect(useAppStore.getState().view).toBe('record'));
    expect(useAppStore.getState().activeArticleId).toBeTruthy();
  });

  it('renames via dialog', async () => {
    await seed('Old name');
    render(<LibraryView />);
    await userEvent.click(await screen.findByRole('button', { name: /actions for Old name/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /^rename$/i }));
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
    await userEvent.click(screen.getByRole('menuitem', { name: /^delete$/i }));
    // Confirmation dialog appears before actual deletion:
    expect(useLibraryStore.getState().articles.length).toBe(1);
    await userEvent.click(screen.getByRole('button', { name: /^delete recording$/i }));
    await waitFor(() => expect(useLibraryStore.getState().articles.length).toBe(0));
  });

  it('duplicates an article including transcript', async () => {
    await putArticle({
      id: 'orig', title: 'Original', createdAt: 0, updatedAt: 0,
      durationSec: 0, transcriptText: 'abc',
    });
    render(<LibraryView />);
    await userEvent.click(await screen.findByRole('button', { name: /actions for Original/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /^duplicate$/i }));
    expect(await screen.findByText(/copy of original/i)).toBeInTheDocument();
  });

  it('duplicate re-points copied chunks to fresh blobs and copies segments', async () => {
    await putArticle({
      id: 'src', title: 'Src', createdAt: 0, updatedAt: 0,
      durationSec: 60, transcriptText: 'hello world',
    });
    await saveSessionAudio('src', [new Blob(['a']), new Blob(['bb'])]);
    await putSegments([
      { id: 'seg-1', articleId: 'src', startTimeSec: 0, endTimeSec: 1, startCharOffset: 0, endCharOffset: 4, text: 'hello', audioChunkIndex: 0, approximate: false },
      { id: 'seg-2', articleId: 'src', startTimeSec: 1, endTimeSec: 2, startCharOffset: 6, endCharOffset: 10, text: 'world', audioChunkIndex: 1, approximate: false },
    ]);
    const srcKeys = (await getChunks('src')).map((c) => c.blobKey);

    const newId = await useLibraryStore.getState().duplicateArticle('src');

    const copyChunks = await getChunks(newId);
    expect(copyChunks.length).toBe(2);
    expect(copyChunks.map((c) => c.blobKey).sort()).not.toEqual([...srcKeys].sort());
    const texts = await Promise.all(copyChunks.map(async (c) => (await getAudioBlob(c.blobKey))!.text()));
    expect(texts).toEqual(['a', 'bb']);
    expect((await getSegments(newId)).length).toBe(2);
  });
});

describe('formatDuration', () => {
  it('rounds total seconds before decomposing into m:ss', () => {
    expect(formatDuration(59.7)).toBe('1:00');
    expect(formatDuration(119.75)).toBe('2:00');
    expect(formatDuration(125)).toBe('2:05');
    expect(formatDuration(0.2)).toBe('0:00');
  });
});
