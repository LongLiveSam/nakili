import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation dialog with full dismissal patterns:
 * Esc (native), backdrop click, [ X ] ghost close, Enter submits,
 * and the browser back button cancels instead of leaving the page.
 */
export function ConfirmDialog({ open, title, children, confirmLabel, danger, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const pushedRef = useRef(false);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      if (!el.open) {
        el.showModal();
        try {
          window.history.pushState({ nakiliDialog: true }, '');
          pushedRef.current = true;
        } catch {
          pushedRef.current = false;
        }
      }
    } else {
      if (el.open) el.close();
      if (pushedRef.current) {
        pushedRef.current = false;
        // Consume the entry we pushed (only if it is still the active one).
        try {
          if ((window.history.state as { nakiliDialog?: boolean } | null)?.nakiliDialog) {
            window.history.back();
          }
        } catch {
          /* ignore */
        }
      }
    }
  }, [open]);

  // Browser back while open = cancel, never navigation away.
  useEffect(() => {
    const onPop = () => {
      if (pushedRef.current) {
        pushedRef.current = false;
        onCancelRef.current();
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      aria-label={title}
      onClick={(e) => {
        if (e.target === ref.current) onCancel();
      }}
    >
      <button
        type="button"
        className="ghost dialog-close"
        aria-label="Close"
        onClick={onCancel}
      >
        [ X ]
      </button>
      <form
        onSubmit={(e) => { e.preventDefault(); onConfirm(); }}
        style={{ minWidth: 320 }}
      >
        <h2 style={{ marginTop: 0, marginRight: 48 }}>{title}</h2>
        {children}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="submit" className={danger ? 'danger' : 'primary'}>{confirmLabel}</button>
        </div>
      </form>
    </dialog>
  );
}
