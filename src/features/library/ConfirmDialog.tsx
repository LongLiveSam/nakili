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

export function ConfirmDialog({ open, title, children, confirmLabel, danger, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog ref={ref} onClose={onCancel}>
      <form
        onSubmit={(e) => { e.preventDefault(); onConfirm(); }}
        style={{ minWidth: 320 }}
      >
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        {children}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="submit" className={danger ? 'danger' : 'primary'}>{confirmLabel}</button>
        </div>
      </form>
    </dialog>
  );
}
