import { render } from '@testing-library/react';
import { afterEach, describe, it, expect } from 'vitest';
import { PlayHighlightOverlay } from './PlayHighlightOverlay';
import { usePlaybackStore } from '../playback/playbackStore';
import type { TranscriptSegment } from '../../core/models';

const TEXT = 'alpha beta';

const segments: TranscriptSegment[] = [
  {
    id: 's0', articleId: 'a1', startTimeSec: 0, endTimeSec: 4,
    startCharOffset: 0, endCharOffset: 4, text: 'alpha',
    audioChunkIndex: 0, approximate: false,
  },
  {
    id: 's1', articleId: 'a1', startTimeSec: 30, endTimeSec: 34,
    startCharOffset: 6, endCharOffset: 9, text: 'beta',
    audioChunkIndex: 1, approximate: false,
  },
];

const chunks = [
  { index: 0, startTimeSec: 0, endTimeSec: 30 },
  { index: 1, startTimeSec: 30, endTimeSec: 60 },
];

function renderOverlay() {
  const taRef = { current: document.createElement('textarea') };
  return render(
    <PlayHighlightOverlay
      taRef={taRef}
      text={TEXT}
      segments={segments}
      chunks={chunks}
      fontSize={18}
    />,
  );
}

afterEach(() => {
  usePlaybackStore.setState({ playingIndex: null, currentTimeSec: 0 });
});

describe('PlayHighlightOverlay', () => {
  it('marks the phrase at chunk-relative time inside the first clip', () => {
    usePlaybackStore.setState({ playingIndex: 0, currentTimeSec: 0.5 });
    const { container } = renderOverlay();
    expect(container.querySelector('mark')?.textContent).toBe('alpha');
  });

  it('offsets playback time by the playing clip start', () => {
    // 2 s into clip 1 == 32 s on the transcript timeline, inside segment s1.
    usePlaybackStore.setState({ playingIndex: 1, currentTimeSec: 2 });
    const { container } = renderOverlay();
    expect(container.querySelector('mark')?.textContent).toBe('beta');
  });

  it('renders plain text while nothing is playing', () => {
    usePlaybackStore.setState({ playingIndex: null, currentTimeSec: 2 });
    const { container } = renderOverlay();
    expect(container.querySelector('mark')).toBeNull();
    expect(container.textContent).toBe(TEXT);
  });
});
