import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { prefersReducedMotion } from '../lib/presence';

type ToastTone = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
  /** Set while the exit animation plays; the element removes itself when it ends. */
  leaving?: boolean;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /*
    Dismissing marks the toast rather than deleting it, so it can animate out; the
    element calls `remove` when its exit animation ends, which keeps the duration in
    the stylesheet beside the animation rather than duplicated here.

    The timer behind it is a guarantee, not the mechanism. An animation that never
    starts never ends — a backgrounded tab is enough — and a toast waiting only on
    `animationend` would sit on screen indefinitely, covering the app with something
    the user has already dismissed. Whichever fires first removes it.
  */
  const dismiss = useCallback((id: number) => {
    // Reduced motion: nothing to animate, so it simply goes.
    if (prefersReducedMotion()) { remove(id); return; }
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    window.setTimeout(() => remove(id), 450);
  }, [remove]);

  const push = useCallback((tone: ToastTone, message: string) => {
    const id = nextId;
    nextId += 1;
    setToasts((prev) => [...prev, { id, tone, message }]);
    // Errors linger a little longer — they usually need reading twice.
    window.setTimeout(() => dismiss(id), tone === 'error' ? 6000 : 4000);
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
  }), [push]);

  const tones: Record<ToastTone, { className: string; Icon: typeof Info }> = {
    success: { className: 'bg-success text-background', Icon: CheckCircle2 },
    error: { className: 'bg-destructive text-destructive-foreground', Icon: AlertCircle },
    info: { className: 'bg-foreground text-background', Icon: Info },
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/*
        Toasts sit above the mobile tab bar rather than behind it. The bar is fixed to
        the bottom edge, and this stack was anchored to the same edge — a confirmation
        would appear underneath it and never be seen. The extra padding is the bar's
        height plus the home indicator, and it collapses to nothing from `lg` up where
        there is no bar.
      */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4
                   pb-[calc(var(--bottom-nav-h)+var(--safe-b)+1rem)] sm:items-end sm:p-6 lg:pb-6"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const { className, Icon } = tones[t.tone];
          return (
            <div
              key={t.id}
              onAnimationEnd={(e) => {
                // Animation events bubble; only this element's own exit should remove it.
                if (e.target === e.currentTarget && t.leaving) remove(t.id);
              }}
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl px-4 py-3 shadow-lg ${
                t.leaving ? 'animate-out-down' : 'animate-in-up'
              } ${className}`}
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <p className="flex-1 text-sm font-medium">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="rounded p-0.5 opacity-80 hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside a ToastProvider');
  return ctx;
}
