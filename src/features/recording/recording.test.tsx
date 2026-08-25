import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import RecordingView from './RecordingView';
import { useRecordingStore, __setServicesForTest } from './recordingStore';
import { useAppStore } from '../../ui/appStore';
import { db } from '../../core/db/db';
import { putArticle } from '../../core/db/repositories';
import type { SpeechService } from '../../core/services/SpeechService';
import type { RecorderService, RecordedChunk } from '../../core/services/RecorderService';

function makeFakes(denied = false) {
  const speech = {
    onInterim: null, onFinal: null, onError: null, stopRequested: false,
    start: vi.fn(), stop: vi.fn(),
  } as unknown as SpeechService;
  const chunks: RecordedChunk[] = [
    { index: 0, blob: new Blob(['a']), startTimeSec: 0, durationSec: 30 },
    { index: 1, blob: new Blob(['b']), startTimeSec: 30, durationSec: 12 },
  ];
  const recorder = {
    requestMicrophone: vi.fn(async () => { if (denied) throw new Error('NotAllowedError'); }),
    onError: null,
    start: vi.fn(),
    stop: vi.fn(async () => chunks),
    releaseStream: vi.fn(),
  } as unknown as RecorderService;
  return { speech, recorder };
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  useAppStore.setState({ view: 'record', activeArticleId: 'a1' });
  await putArticle({
    id: 'a1', title: 'Session', createdAt: 0, updatedAt: 0,
    durationSec: 0, transcriptText: '',
  });
  useRecordingStore.setState({ status: 'idle', elapsedSec: 0, interimText: '', finals: [], errorMessage: null });
});

describe('recording view', () => {
  it('streams interim text then finalizes it', async () => {
    const { speech, recorder } = makeFakes();
    __setServicesForTest(speech, recorder);
    render(<RecordingView />);

    await waitFor(() => expect(recorder.requestMicrophone).toHaveBeenCalled());
    await waitFor(() => expect(useRecordingStore.getState().status).toBe('recording'));

    speech.onInterim!('hel');
    expect(await screen.findByText(/hel/)).toBeInTheDocument();

    speech.onFinal!('hello world', 2);
    speech.onInterim!('an');
    await waitFor(() => expect(screen.getByText('hello world')).toBeInTheDocument());
  });

  it('stop saves article, ordered chunks, segments, then opens editor', async () => {
    const { speech, recorder } = makeFakes();
    __setServicesForTest(speech, recorder);
    render(<RecordingView />);
    await waitFor(() => expect(useRecordingStore.getState().status).toBe('recording'));

    speech.onFinal!('hello world', 2);
    speech.onFinal!('more words', 35);
    await userEvent.click(screen.getByRole('button', { name: /^stop$/i }));

    await waitFor(() => expect(useAppStore.getState().view).toBe('editor'));
    const article = await db.articles.get('a1');
    expect(article!.transcriptText).toBe('hello world more words');
    expect(article!.durationSec).toBeGreaterThan(0);

    const segs = (await db.transcriptSegments.where('articleId').equals('a1').toArray())
      .sort((a, b) => a.startCharOffset - b.startCharOffset);
    expect(segs.length).toBe(2);
    expect(segs[0]).toMatchObject({ startCharOffset: 0, endCharOffset: 10, audioChunkIndex: 0 });
    expect(segs[1]).toMatchObject({ startCharOffset: 12, endCharOffset: 21, audioChunkIndex: 1 });

    const chunks = (await db.audioChunks.where('articleId').equals('a1').toArray())
      .sort((a, b) => a.index - b.index);
    expect(chunks.map((c) => c.index)).toEqual([0, 1]);
    expect(recorder.releaseStream).toHaveBeenCalled();
  });

  it('mic denial shows explanation and stays idle', async () => {
    const { speech, recorder } = makeFakes(true);
    __setServicesForTest(speech, recorder);
    render(<RecordingView />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/microphone access denied/i);
    expect(useRecordingStore.getState().status).toBe('idle');
    expect(recorder.start).not.toHaveBeenCalled();
  });

  it('shows a back affordance while not recording', async () => {
    const { speech, recorder } = makeFakes(true);
    __setServicesForTest(speech, recorder);
    render(<RecordingView />);
    expect(await screen.findByRole('button', { name: /back to recordings/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /back to recordings/i }));
    expect(useAppStore.getState().view).toBe('home');
  });
});
