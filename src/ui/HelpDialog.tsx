import { useEffect, useRef } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function HelpDialog({ open, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label="Help"
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
    >
      <button className="ghost dialog-close" aria-label="Close" onClick={onClose}>[ X ]</button>
      <div style={{ maxWidth: 560 }}>
      <h2 style={{ marginTop: 0 }}>Help</h2>

      <h3>Shortcuts</h3>
      <p>
        <code>Ctrl+Shift+D</code> start/stop dictation ·{' '}
        <code>Ctrl+Enter</code> paragraph break at cursor ·{' '}
        <code>Esc</code> close dialogs
      </p>

      <h3>Voice commands</h3>
      <p>
        While dictating, say “period”, “comma”, “question mark”, “exclamation
        mark”, “new line”, or “new paragraph” and Nakili writes the punctuation
        or break for you.
      </p>

      <h3>How it works</h3>
        <p>
          Choose <strong>New recording</strong>, speak, and your words appear as you talk.
          Press <strong>Stop</strong> to save. Your transcript is always editable — click
          anywhere in the text and edit like any document. Every recording keeps its audio,
          split into 30-second clips.
        </p>

        <h3>Fixing mistakes with clips</h3>
        <p>
          Click anywhere in your transcript: the clip covering those words highlights in the
          Clips panel. Play it to hear exactly what was said there, fix the text, move on. A
          “~” mark means edits have shifted the text, so the match is approximate.
        </p>

        <h3>Microphone permission</h3>
        <p>
          Recording needs microphone access. If you denied it, click the lock icon in the
          address bar → Site settings → allow Microphone, then reload.
        </p>

        <h3>No sound from a clip?</h3>
        <p>
          Make sure your system output device is correct and the tab isn’t muted
          (right-click the tab). If a clip is silent while others play, the microphone may
          have been on the wrong input device during that window.
        </p>

        <h3>Exporting</h3>
        <p>
          Use <strong>Download</strong> in the editor or the ⋮ menu on any recording to save
          the transcript as <code>.txt</code> or the full audio as <code>.webm</code>. Files
          go to your Downloads folder.
        </p>

        <h3>Privacy</h3>
        <p>
          Everything is stored locally in this browser (IndexedDB). No account, no upload,
          no sync. Speech-to-text itself is provided by your browser’s speech service.
          Clearing this site’s data deletes all recordings permanently.
        </p>

        <h3>Contact</h3>
        <p>
          Problems or feedback:{' '}
          <a href="mailto:culturedrabbit@gmail.com">culturedrabbit@gmail.com</a>
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </dialog>
  );
}
