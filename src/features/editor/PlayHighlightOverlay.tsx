import { useEffect, useRef } from 'react';
import { usePlaybackStore } from '../playback/playbackStore';
import { findSegmentForTime } from '../../core/services/MappingService';
import { snapToWord } from '../../core/services/audioAnalysis';
import type { TranscriptSegment } from '../../core/models';

interface Props {
  taRef: React.RefObject<HTMLTextAreaElement | null>;
  text: string;
  segments: TranscriptSegment[];
  fontSize: number;
}

/**
 * Mirror layer behind the textarea that marks the phrase currently being
 * spoken while a clip plays. The textarea background is transparent inside
 * .ta-wrap so the highlight shows through; typography must match exactly.
 */
export function PlayHighlightOverlay({ taRef, text, segments, fontSize }: Props) {
  const mirrorRef = useRef<HTMLDivElement>(null);
  const t = usePlaybackStore((s) => s.currentTimeSec);
  const playingIndex = usePlaybackStore((s) => s.playingIndex);
  const active = playingIndex !== null;

  // Keep the mirror scrolled in lock-step with the textarea while playing.
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const sync = () => {
      if (mirrorRef.current && taRef.current) {
        mirrorRef.current.scrollTop = taRef.current.scrollTop;
      }
      raf = requestAnimationFrame(sync);
    };
    raf = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(raf);
  }, [active, taRef]);

  let range: [number, number] | null = null;
  if (active && segments.length > 0) {
    const seg = findSegmentForTime(segments, t);
    if (seg && seg.endCharOffset > seg.startCharOffset) {
      const span = Math.max(0.4, seg.endTimeSec - seg.startTimeSec);
      const frac = Math.max(0, Math.min(1, (t - seg.startTimeSec) / span));
      const approx = seg.startCharOffset + Math.round(frac * (seg.endCharOffset - seg.startCharOffset + 1));
      const snapped = snapToWord(text, approx, seg.startCharOffset, seg.endCharOffset + 1);
      if (snapped[1] > snapped[0]) range = snapped;
    }
  }

  return (
    <div
      ref={mirrorRef}
      aria-hidden="true"
      className="ta-mirror"
      style={{ fontSize }}
    >
      {range ? (
        <>
          {text.slice(0, range[0])}
          <mark className="play-mark">{text.slice(range[0], range[1])}</mark>
          {text.slice(range[1])}
        </>
      ) : (
        text
      )}
    </div>
  );
}
