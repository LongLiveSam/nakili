import { useEffect, useRef, useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
}

function loadVocab(): string {
  try {
    return localStorage.getItem('nakili-vocab') ?? '';
  } catch {
    return '';
  }
}

export function SettingsDialog({ open, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState(loadVocab);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      setText(loadVocab());
      setSaved(false);
      el.showModal();
    }
    if (!open && el.open) el.close();
  }, [open]);

  const save = () => {
    try {
      localStorage.setItem('nakili-vocab', text);
    } catch {
      /* storage unavailable */
    }
    setSaved(true);
    setTimeout(() => onClose(), 600);
  };

  return (
    <dialog ref={ref} onClose={onClose} aria-label="Settings">
      <h2 style={{ marginTop: 0 }}>Settings</h2>

      <h3>Vocabulary</h3>
      <p>
        One term per line — names, jargon, product words the recognizer should watch for.
        Chrome passes these to the speech engine as a hint; support is best-effort.
      </p>
      <label className="visually-hidden" htmlFor="vocab">Custom terms</label>
      <textarea
        id="vocab"
        value={text}
        onChange={(e) => { setText(e.target.value); setSaved(false); }}
        rows={6}
        style={{ width: '100%', minHeight: 120 }}
        placeholder={'Kubernetes\nSchwarzschild\nNakili'}
      />

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
        <button onClick={onClose}>Cancel</button>
        <button className="primary" onClick={save}>{saved ? '[Saved]' : 'Save'}</button>
      </div>
    </dialog>
  );
}
