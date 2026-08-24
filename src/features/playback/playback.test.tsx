import 'fake-indexeddb/auto';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { usePlaybackStore } from './playbackStore';
import { saveSessionAudio } from '../../core/db/repositories';
import { db } from '../../core/db/db';
import { useAppStore } from '../../ui/appStore';

function Harness() {
  const { playingIndex, toggle, currentTimeSec, durationSec, seek } = usePlaybackStore();
  return (
    <div>
      <button onClick={() => void toggle(1)}>toggle-1</button>
      <button onClick={() => seek(0.5)}>seek-half</button>
      <output>playing={String(playingIndex)} t={currentTimeSec.toFixed(1)} d={durationSec.toFixed(1)}</output>
    </div>
  );
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  useAppStore.setState({ view: 'editor', activeArticleId: 'a1' });
  await saveSessionAudio('a1', [
    new Blob(['aaaa'], { type: 'audio/webm' }),
    new Blob(['bbbb'], { type: 'audio/webm' }),
  ]);
  usePlaybackStore.setState({ playingIndex: null, currentTimeSec: 0, durationSec: 0 });
});

describe('playback store', () => {
  it('toggles playing state for a chunk index', async () => {
    render(<><Harness /></>);
    fireEvent.click(screen.getByText('toggle-1'));
    await waitFor(() => expect(usePlaybackStore.getState().playingIndex).toBe(1));
    fireEvent.click(screen.getByText('toggle-1'));
    await waitFor(() => expect(usePlaybackStore.getState().playingIndex).toBe(null));
  });

  it('seek updates currentTime proportionally to duration', async () => {
    render(<><Harness /></>);
    usePlaybackStore.setState({ durationSec: 30 });
    fireEvent.click(screen.getByText('seek-half'));
    expect(usePlaybackStore.getState().currentTimeSec).toBeCloseTo(15, 0);
  });

  it('ignores toggles for missing chunks', async () => {
    render(<><Harness /></>);
    const before = usePlaybackStore.getState().playingIndex;
    await usePlaybackStore.getState().toggle(99);
    expect(usePlaybackStore.getState().playingIndex).toBe(before);
  });
});
