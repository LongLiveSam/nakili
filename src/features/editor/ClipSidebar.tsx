import { useEffect, useRef } from 'react';
import { usePlaybackStore } from '../playback/playbackStore';

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

function SeekSlider({
  index, fraction, onSeek,
}: {
  index: number;
  fraction?: number;
  onSeek: (fraction: number) => void;
}) {
  const currentTimeSec = usePlaybackStore((s) => s.currentTimeSec);
  const durationSec = usePlaybackStore((s) => s.durationSec);
  const value = fraction ?? (durationSec > 0 ? currentTimeSec / durationSec : 0);
  return (
    <input
      type="range"
      min={0}
      max={1}
      step={0.01}
      value={value}
      aria-label={`Seek within clip ${index + 1}`}
      onChange={(e) => onSeek(Number(e.target.value))}
      style={{ width: '100%' }}
    />
  );
}

export function ClipSidebar({
  chunks, activeClipIndex, approximate, playingIndex, progressFraction, panelOpen, onTogglePlay, onSeek,
}: Props) {
  const activeRef = useRef<HTMLLIElement>(null);

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
      <ul role="list" style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 4 }}>
        {chunks.map((c) => {
          const isActive = c.index === activeClipIndex;
          const isPlaying = c.index === playingIndex;
          return (
            <li key={c.index} ref={isActive ? activeRef : undefined}>
              <button
                aria-current={isActive ? 'true' : undefined}
                aria-label={
                  `Clip ${c.index + 1}, ${fmt(c.startTimeSec)} to ${fmt(c.endTimeSec)}` +
                  (isActive && approximate ? ', approximately matches cursor' : '')
                }
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderColor: isActive ? 'var(--accent)' : undefined,
                  borderWidth: isActive ? 2 : undefined,
                }}
                onClick={() => onTogglePlay(c.index)}
              >
                <span>Clip {c.index + 1}</span>
                <span style={{ color: 'var(--fg-subtle)' }}>
                  {isActive && approximate ? '~ ' : ''}
                  {isPlaying ? '⏸' : '▶'} {fmt(c.startTimeSec)}–{fmt(c.endTimeSec)}
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
