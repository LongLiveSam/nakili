import 'fake-indexeddb/auto';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import EditorView from './EditorView';
import { useEditorStore } from './editorStore';
import { db } from '../../core/db/db';
import { putArticle, saveSessionAudio, putSegments } from '../../core/db/repositories';
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
  useAppStore.setState({ view: 'editor', activeArticleId: 'a1' });
  await putArticle({
    id: 'a1', title: 'Essay', createdAt: 0, updatedAt: 1,
    durationSec: 75, transcriptText: 'hello world more words',
  });
  await saveSessionAudio('a1', [new Blob(['a']), new Blob(['b']), new Blob(['c'])]);
  await putSegments([
    { id: 's1', articleId: 'a1', startTimeSec: 2, endTimeSec: 3, startCharOffset: 0, endCharOffset: 10, text: 'hello world', audioChunkIndex: 0, approximate: false },
    { id: 's2', articleId: 'a1', startTimeSec: 35, endTimeSec: 36, startCharOffset: 12, endCharOffset: 21, text: 'more words', audioChunkIndex: 1, approximate: false },
  ]);
  useEditorStore.setState({
    article: null, segments: [], chunkCount: 0, saved: true,
    cursorOffset: 0, activeClipIndex: null, approximate: false,
  });
});

describe('editor', () => {
  it('navigates back to the library via the header affordance', async () => {
    render(<EditorView />);
    const back = await screen.findByRole('button', { name: /back to recordings/i });
    await userEvent.click(back);
    expect(useAppStore.getState().view).toBe('home');
  });

  it('loads article text and clip list', async () => {
    render(<EditorView />);
    const ta = await screen.findByRole('textbox', { name: /transcript/i });
    expect(ta).toHaveValue('hello world more words');
    expect(await screen.findByText(/^clip 1$/i)).toBeInTheDocument();
    expect(screen.getByText(/^clip 3$/i)).toBeInTheDocument();
  });

  it('highlights the clip containing the cursor', async () => {
    render(<EditorView />);
    const ta = await screen.findByRole('textbox', { name: /transcript/i });
    fireEvent.select(ta, { target: { selectionStart: 14 } });
    await waitFor(() => expect(useEditorStore.getState().activeClipIndex).toBe(1));
    const active = await screen.findByRole('button', { name: /clip 2/i });
    expect(active).toHaveAttribute('aria-current', 'true');
  });

  it('marks approximate badge when cursor is unmapped', async () => {
    render(<EditorView />);
    const ta = await screen.findByRole('textbox', { name: /transcript/i });
    fireEvent.select(ta, { target: { selectionStart: 11 } }); // gap between segments
    await waitFor(() => expect(useEditorStore.getState().approximate).toBe(true));
    const active = await screen.findByRole('button', { name: /approximately matches cursor/i });
    expect(active).toHaveAttribute('aria-current', 'true');
  });

  it('autosaves edits and shifts segment offsets', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<EditorView />);
    const ta = await screen.findByRole('textbox', { name: /transcript/i });
    fireEvent.change(ta, { target: { value: 'hello XX world more words' } });
    expect(useEditorStore.getState().saved).toBe(false);

    await vi.advanceTimersByTimeAsync(600);
    const stored = await db.articles.get('a1');
    expect(stored!.transcriptText).toBe('hello XX world more words');

    const segs = await db.transcriptSegments.where('articleId').equals('a1').toArray();
    expect(segs.find((s) => s.id === 's1')!.approximate).toBe(true);
    expect(segs.find((s) => s.id === 's2')).toMatchObject({ startCharOffset: 15, approximate: false });
    expect(useEditorStore.getState().saved).toBe(true);
    vi.useRealTimers();
  });

  it('shows inline error status and stays unsaved when autosave fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const putSpy = vi.spyOn(db.articles, 'put').mockRejectedValueOnce(new Error('quota exceeded'));
    try {
      render(<EditorView />);
      const ta = await screen.findByRole('textbox', { name: /transcript/i });
      fireEvent.change(ta, { target: { value: 'hello YY world more words' } });
      expect(useEditorStore.getState().saved).toBe(false);

      await vi.advanceTimersByTimeAsync(600);
      expect(useEditorStore.getState().saved).toBe(false);
      expect(useEditorStore.getState().saveError).toBe(true);
      expect(screen.getByText('[AUTOSAVE FAILED — WILL RETRY]')).toBeInTheDocument();
    } finally {
      putSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it('renames the article from the editor header', async () => {
    render(<EditorView />);
    await userEvent.click(await screen.findByRole('button', { name: /^rename$/i }));
    const input = screen.getByLabelText(/title/i);
    await userEvent.clear(input);
    await userEvent.type(input, 'Renamed!');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(await screen.findByText('Renamed!')).toBeInTheDocument();
    expect((await db.articles.get('a1'))!.title).toBe('Renamed!');
  });

  it('auto-opens the clip panel when the cursor moves onto a mapped region', async () => {
    render(<EditorView />);
    const ta = await screen.findByRole('textbox', { name: /transcript/i });

    const aside = screen.getByRole('complementary', { name: /audio clips/i });
    expect(aside.dataset.open).toBe('false');

    fireEvent.select(ta, { target: { selectionStart: 2 } });
    await waitFor(() => expect(aside.dataset.open).toBe('true'));

    const toggleBtn = screen.getByRole('button', { name: /hide clips/i });
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
  });

  it('manual toggle closes and reopens the panel', async () => {
    render(<EditorView />);
    const btn = await screen.findByRole('button', { name: /^clips$/i });
    await userEvent.click(btn);
    const aside = screen.getByRole('complementary', { name: /audio clips/i });
    expect(aside.dataset.open).toBe('true');
    const hideBtn = screen.getByRole('button', { name: /hide clips/i });
    expect(hideBtn).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(hideBtn);
    expect(aside.dataset.open).toBe('false');
    expect(screen.getByRole('button', { name: /^clips$/i })).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(screen.getByRole('button', { name: /^clips$/i }));
    expect(aside.dataset.open).toBe('true');
    expect(screen.getByRole('button', { name: /hide clips/i })).toHaveAttribute('aria-expanded', 'true');
  });
});
