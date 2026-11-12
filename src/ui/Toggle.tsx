import { useEffect, useRef, useState } from 'react';

/**
 * Broadcast Desk switch: a standard track-and-thumb toggle.
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
    <div className="toggle-row">
      <span className="label">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        className={`toggle${on ? ' on' : ''}`}
        onClick={() => {
          const next = !on;
          setOn(next);
          try {
            localStorage.setItem(storageKey, next ? 'on' : 'off');
          } catch {
            /* ignore */
          }
        }}
      >
        <span className="toggle-track" aria-hidden="true">
          <span className="toggle-thumb" />
        </span>
      </button>
    </div>
  );
}
