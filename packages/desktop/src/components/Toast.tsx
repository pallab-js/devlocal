import { createContext, useCallback, useContext, useRef, useState } from "react";
import { cn } from "../lib/cn";

interface Toast { id: number; message: string; type: "success" | "error" | "info"; }
interface ToastContextValue { toast: (message: string, type?: Toast["type"]) => void; dismiss: (id: number) => void; }

const ToastContext = createContext<ToastContextValue>({ toast: () => {}, dismiss: () => {} });

export function useToast() { return useContext(ToastContext); }

const TOAST_COLORS: Record<Toast["type"], string> = {
  success: "text-green bg-green-dim border-green-border",
  error:   "text-error bg-error-dim border-error-border",
  info:    "text-text-2 bg-surface-2 border-border",
};

const TOAST_ICONS: Record<Toast["type"], string> = {
  success: "✓",
  error:   "✕",
  info:    "ℹ",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = ++nextId.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    const timer = setTimeout(() => {
      timers.current.delete(id);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
    timers.current.set(id, timer);
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      {/* Toast container: aria-live so screen readers announce new toasts */}
      <div
        className="fixed bottom-5 right-5 flex flex-col gap-2 z-[9999] pointer-events-none"
        role="status"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "flex items-start gap-2.5 pl-3 pr-2 py-2.5 rounded-lg text-[13px] font-mono",
              "shadow-[0_4px_16px_rgba(0,0,0,0.25)] border",
              "max-w-[380px] pointer-events-auto",
              "animate-toast-in",
              TOAST_COLORS[t.type],
            )}
            role="alert"
          >
            {/* Icon */}
            <span className="text-[12px] font-bold mt-0.5 shrink-0" aria-hidden="true">
              {TOAST_ICONS[t.type]}
            </span>
            {/* Message */}
            <span className="flex-1 leading-snug">{t.message}</span>
            {/* Dismiss */}
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="bg-transparent border-none cursor-pointer opacity-50 hover:opacity-100 shrink-0 leading-none p-0.5 rounded transition-opacity"
              style={{ color: "inherit" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}