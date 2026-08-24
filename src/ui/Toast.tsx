import { useToastStore } from './toastStore';

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="toast-host">
      {toasts.map((t) => (
        <div key={t.id} role="status" className="toast">{t.message}</div>
      ))}
    </div>
  );
}
