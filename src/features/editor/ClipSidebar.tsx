import { useEffect, useRef } from 'react';
import { usePlaybackStore } from '../playback/playbackStore';
import { PlayIcon, PauseIcon } from '../../ui/icons';

export interface ClipRowData {
  index: number;
  startTimeSec: number;
  endTimeSec: number;
}

interface Props {
  chunks: ClipRowData[];
  activeClipIndex: number | null;
  approximate: boolean;
  playingIndex: number | null;
  progressFraction?: number;
  panelOpen?: boolean;
  onTogglePlay: (index: number) => void;
  onSeek?: (fraction: number) => void;
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const SEGMENTS = 24;

function SeekSlider({
  index, fraction, onSeek,
}: {
  index: number;
  fraction?: number;
  onSeek: (fraction: number) => void;
}) {
  const currentTimeSec = usePlaybackStore((s) => s.currentTimeSec);
  const durationSec = usePlaybackStore((s) => s.durationSec);
  const progress = fraction ?? (durationSec > 0 ? currentTimeSec / durationSec : 0);
  const clamped = Math.max(0, Math.min(1, progress));
  const filled = Math.round(clamped * SEGMENTS);
  return (
    <div className="seek-wrap">
      <div className="seek-segments" aria-hidden="true">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <i key={i} className={i < filled ? 'on' : undefined} />
        ))}
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={clamped}
        aria-label={`Seek within clip ${index + 1}`}
        onChange={(e) => onSeek(Number(e.target.value))}
      />
    </div>
  );
}

export function ClipSidebar({
  chunks, activeClipIndex, approximate, playingIndex, progressFraction, panelOpen, onTogglePlay, onSeek,
}: Props) {
  const activeRef = useRef<HTMLLIElement>(null);
  const error = usePlaybackStore((s) => s.error);

  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [activeClipIndex]);

  return (
    <aside
      aria-label="Audio clips"
      className={`clip-sidebar clip-panel${panelOpen ? ' open' : ''}`}
      data-open={panelOpen ? 'true' : 'false'}
    >
      <h2>Clips</h2>
      {error && (
        <p className="status-line error" role="alert" style={{ margin: '0 0 var(--space-sm)' }}>
          {error}
        </p>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {chunks.map((c) => {
          const isActive = c.index === activeClipIndex;
          const isPlaying = c.index === playingIndex;
          return (
            <li key={c.index} ref={isActive ? activeRef : undefined}>
              <button
                aria-current={isActive ? 'true' : undefined}
                className={`clip-row${isActive ? ' clip-row-active' : ''}`}
                aria-label={
                  `Clip ${c.index + 1}, ${fmt(c.startTimeSec)} to ${fmt(c.endTimeSec)}` +
                  (isPlaying ? ', playing' : '') +
                  (isActive && approximate ? ', approximately matches cursor' : '')
                }
                onClick={() => onTogglePlay(c.index)}
              >
                <span>Clip {c.index + 1}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {isActive && approximate && <span className="approx-chip">~</span>}
                  <span className="clip-time">{fmt(c.startTimeSec)}–{fmt(c.endTimeSec)}</span>
                  {isPlaying ? <PauseIcon /> : <PlayIcon />}
                </span>
              </button>
              {isPlaying && onSeek && (
                <SeekSlider index={c.index} fraction={progressFraction} onSeek={onSeek} />
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
