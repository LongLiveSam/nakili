import { useEffect, useRef } from 'react';

interface Props {
  open: boolean;
  onDone: () => void;
}

/** First-run, three-step walkthrough. Shown once (localStorage flag). */
export function TutorialOverlay({ open, onDone }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog ref={ref} onClose={onDone} aria-label="Welcome">
      <button className="ghost dialog-close" aria-label="Close" onClick={onDone}>[ X ]</button>
      <h2 style={{ marginTop: 0 }}>Three things to know</h2>

      <div style={{ display: 'grid', gap: 16, margin: '16px 0' }}>
        <div>
          <p className="label">1 · Cursor = playback</p>
          <p>Click anywhere in your transcript and the exact 30-second clip highlights — play it to hear that moment.</p>
        </div>
        <div>
          <p className="label">2 · Speak the structure</p>
          <p>Say “new paragraph”, “period”, “comma” while dictating. Nakili writes the formatting for you.</p>
        </div>
        <div>
          <p className="label">3 · Shortcuts</p>
          <p><code>Ctrl+Shift+D</code> start/stop · <code>Ctrl+Enter</code> paragraph break at cursor.</p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="primary" onClick={onDone}>Got it</button>
      </div>
    </dialog>
  );
}
