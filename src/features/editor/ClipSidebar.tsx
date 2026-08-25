import { useEffect, useRef, useState } from 'react';
import { usePlaybackStore } from '../playback/playbackStore';
import { PlayIcon, PauseIcon, RepeatIcon } from '../../ui/icons';

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
  onDeleteClip?: (index: number) => void;
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
  chunks, activeClipIndex, approximate, playingIndex, progressFraction, panelOpen, onTogglePlay, onSeek, onDeleteClip,
}: Props) {
  const activeRef = useRef<HTMLLIElement>(null);
  const error = usePlaybackStore((s) => s.error);
  const loop = usePlaybackStore((s) => s.loop);
  const setLoop = usePlaybackStore((s) => s.setLoop);
  const rate = usePlaybackStore((s) => s.rate);
  const setRate = usePlaybackStore((s) => s.setRate);
  const [armedDelete, setArmedDelete] = useState<number | null>(null);

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
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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
                {onDeleteClip && (
                  <button
                    className={armedDelete === c.index ? 'danger' : 'ghost'}
                    aria-label={
                      armedDelete === c.index
                        ? `Confirm delete clip ${c.index + 1}`
                        : `Delete clip ${c.index + 1}`
                    }
                    onClick={() => {
                      if (armedDelete === c.index) {
                        onDeleteClip(c.index);
                        setArmedDelete(null);
                      } else {
                        setArmedDelete(c.index);
                      }
                    }}
                    onBlur={() => setArmedDelete(null)}
                    style={{ minWidth: 44, padding: '0 10px' }}
                  >
                    {armedDelete === c.index ? 'Sure?' : '✕'}
                  </button>
                )}
              </div>
              {isPlaying && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                  {onSeek && <SeekSlider index={c.index} fraction={progressFraction} onSeek={onSeek} />}
                  <button
                    aria-pressed={loop}
                    aria-label={`Loop clip ${c.index + 1}`}
                    onClick={() => setLoop(!loop)}
                    style={{ minWidth: 44, padding: '0 10px', color: loop ? 'var(--text-display)' : undefined }}
                  >
                    <RepeatIcon />
                  </button>
                  <label className="visually-hidden" htmlFor={`rate-${c.index}`}>Playback speed</label>
                  <select
                    id={`rate-${c.index}`}
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value))}
                    style={{
                      fontFamily: '"Space Mono", monospace',
                      fontSize: 12,
                      background: 'var(--surface)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-visible)',
                      borderRadius: 8,
                      minHeight: 44,
                      padding: '0 8px',
                    }}
                  >
                    {[0.75, 1, 1.25, 1.5].map((r) => (
                      <option key={r} value={r}>{r}×</option>
                    ))}
                  </select>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
