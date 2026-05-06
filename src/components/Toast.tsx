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
      <div
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          zIndex: 9999,
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => {
          const c = COLOR[t.type];
          return (
            <div
              key={t.id}
              style={{
                padding: "10px 16px",
                borderRadius: 6,
                border: `1px solid ${c.border}`,
                background: c.bg,
                color: c.color,
                fontSize: 13,
                fontFamily: "var(--font-mono)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                animation: "toast-in 0.2s ease",
                maxWidth: 360,
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
