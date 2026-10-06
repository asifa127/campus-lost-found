import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);

// Pass as the second argument of react-hook-form's handleSubmit: handleSubmit(onValid, onInvalid)
export const INVALID_FORM = 'Please check the highlighted fields.';
export function useInvalid() {
  const toast = useToast();
  return useCallback(() => toast.error(INVALID_FORM), [toast]);
}

const STYLES = {
  success: { icon: CheckCircle2, cls: 'text-positive' },
  error: { icon: AlertCircle, cls: 'text-destructive' },
  info: { icon: Info, cls: 'text-muted-foreground' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((type, message) => {
    const id = ++nextId.current;
    setToasts((t) => [...t.slice(-3), { id, type, message }]);
    setTimeout(() => dismiss(id), type === 'error' ? 6000 : 3500);
  }, [dismiss]);

  const toast = useMemo(() => ({
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
  }), [push]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end" aria-live="polite">
        {toasts.map(({ id, type, message }) => {
          const { icon: Icon, cls } = STYLES[type];
          return (
            <div key={id} role="status" className="swap pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border border-border bg-background p-3.5 shadow-md">
              <Icon className={`mt-px size-4 shrink-0 ${cls}`} aria-hidden />
              <p className="flex-1 text-sm">{message}</p>
              <button onClick={() => dismiss(id)} className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground" aria-label="Dismiss notification">
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
