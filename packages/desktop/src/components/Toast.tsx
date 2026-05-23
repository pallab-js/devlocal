import { createContext, useCallback, useContext, useRef, useState } from "react";

interface Toast { id: number; message: string; type: "success" | "error" | "info"; }

interface ToastContextValue { toast: (message: string, type?: Toast["type"]) => void; dismiss: (id: number) => void; }

const ToastContext = createContext<ToastContextValue>({ toast: () => {}, dismiss: () => {} });

export function useToast() { return useContext(ToastContext); }

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
    }, 4000);
    timers.current.set(id, timer);
  }, []);

  const COLOR: Record<Toast["type"], { color: string; bg: string; border: string }> = {
    success: { color: "var(--green)", bg: "var(--green-dim)", border: "var(--green-border)" },
    error:   { color: "var(--error)", bg: "var(--error-dim)", border: "rgba(255,180,171,0.3)" },
    info:    { color: "var(--text-2)", bg: "var(--surface-2)", border: "var(--border)" },
  };

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-[9999] pointer-events-none">
        {toasts.map((t) => {
          const c = COLOR[t.type];
          return (
            <div key={t.id}
              className="flex items-start gap-2 px-4 py-2.5 rounded-md text-[13px] font-mono shadow-[0_4px_12px_rgba(0,0,0,0.3)] animate-[toast-in_0.2s_ease] max-w-[360px] pointer-events-auto"
              style={{ border: `1px solid ${c.border}`, background: c.bg, color: c.color }}>
              <span className="flex-1">{t.message}</span>
              <button onClick={() => dismiss(t.id)}
                className="bg-none border-none cursor-pointer opacity-60 hover:opacity-100 shrink-0 leading-none"
                style={{ background: "none", border: "none", color: "inherit", fontSize: 14, padding: 0, lineHeight: 1 }}>
                &times;
              </button>
            </div>
          );
        })}
      </div>
      <style>{`@keyframes toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </ToastContext.Provider>
  );
}