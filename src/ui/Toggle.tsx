import { useEffect, useRef, useState } from 'react';

/**
 * Nothing-style mechanical toggle: pill track, square-ended thumb.
 * Instant-save semantics — writes the backing key on change.
 */
export function Toggle({
  label, storageKey, defaultOn = true, onChange,
}: {
  label: string;
  storageKey: string;
  defaultOn?: boolean;
  onChange?: (on: boolean) => void;
}) {
  const [on, setOn] = useState(() => {
    try {
      const v = localStorage.getItem(storageKey);
      return v === null ? defaultOn : v === 'on';
    } catch {
      return defaultOn;
    }
  });
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) onChange?.(on);
    else mounted.current = true;
  }, [on]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44 }}>
      <span className="label">{label}</span>
      <button
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => {
          const next = !on;
          setOn(next);
          try {
            localStorage.setItem(storageKey, next ? 'on' : 'off');
          } catch {
            /* ignore */
          }
        }}
        style={{
          width: 56,
          minWidth: 56,
          padding: 2,
          height: 28,
          minHeight: 28,
          borderRadius: 999,
          borderColor: on ? 'var(--text-display)' : 'var(--border-visible)',
          background: on ? 'var(--text-display)' : 'transparent',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'block',
            width: 22,
            height: 22,
            borderRadius: 2,
            marginLeft: on ? 'auto' : 0,
            background: on ? 'var(--bg)' : 'var(--text-disabled)',
            transition: 'margin-left var(--speed)',
          }}
        />
      </button>
    </div>
  );
}
