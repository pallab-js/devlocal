import { createContext, useCallback, useContext, useRef, useState } from "react";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

interface ToastContextValue {
  toast: (message: string, type?: Toast["type"]) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const toast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = ++nextId.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const COLOR: Record<Toast["type"], { color: string; bg: string; border: string }> = {
    success: { color: "var(--green)", bg: "var(--green-dim)", border: "var(--green-border)" },
    error: { color: "var(--error)", bg: "var(--error-dim)", border: "rgba(255,180,171,0.3)" },
    info: { color: "var(--text-2)", bg: "var(--surface-2)", border: "var(--border)" },
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-[9999] pointer-events-none">
        {toasts.map((t) => {
          const c = COLOR[t.type];
          return (
            <div
              key={t.id}
              className="px-4 py-2.5 rounded-md text-[13px] font-mono shadow-[0_4px_12px_rgba(0,0,0,0.3)] animate-[toast-in_0.2s_ease] max-w-[360px]"
              style={{
                border: `1px solid ${c.border}`,
                background: c.bg,
                color: c.color,
              }}
            >
              {t.message}
            </div>
          );
        })}
      </div>
      <style>{`@keyframes toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </ToastContext.Provider>
  );
}
