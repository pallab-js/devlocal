import { useState, useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import { AppShell } from "./components/layout/AppShell";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastProvider } from "./components/Toast";
import { Dashboard } from "./pages/Dashboard";
import { Environments } from "./pages/Environments";
import Images from "./pages/Images";
import { Logs } from "./pages/Logs";
import { Network } from "./pages/Network";
import { Volumes } from "./pages/Volumes";
import { Settings } from "./pages/Settings";
import { ipc } from "./lib/ipc";
import { useAppStore } from "./store/useAppStore";

// ── Docker Status Banner ──────────────────────────────────────────────────────

function DockerStatusBanner({ online }: { online: boolean }) {
  if (online) return null;
  return (
    <div
      role="alert"
      className="bg-orange/10 border-b border-orange/20 py-2 px-4 flex items-center justify-center gap-2 animate-[slide-in-from-top_0.3s_ease]"
    >
      <span className="flex h-2 w-2 rounded-full bg-orange animate-pulse-dot" aria-hidden="true" />
      <span className="text-xs font-medium text-orange">
        Docker is offline — some features may be unavailable.
      </span>
    </div>
  );
}

// ── Keyboard Shortcuts Guide ──────────────────────────────────────────────────

const ROUTES: Record<string, string> = {
  "1": "/",
  "2": "/logs",
  "3": "/environments",
  "4": "/network",
  "5": "/settings",
  "6": "/images",
  "7": "/volumes",
};

const SHORTCUT_LABELS: { keys: string[]; label: string }[] = [
  { keys: ["⌘", "1"], label: "Dashboard" },
  { keys: ["⌘", "2"], label: "Logs" },
  { keys: ["⌘", "3"], label: "Environments" },
  { keys: ["⌘", "4"], label: "Network" },
  { keys: ["⌘", "5"], label: "Settings" },
  { keys: ["⌘", "6"], label: "Images" },
  { keys: ["⌘", "7"], label: "Volumes" },
];

function KeyboardShortcuts() {
  const navigate = useNavigate();
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey) {
        if (ROUTES[e.key]) {
          e.preventDefault();
          navigate(ROUTES[e.key]);
          setShowGuide(false);
        }
      } else if (e.key === "?") {
        e.preventDefault();
        setShowGuide((prev) => !prev);
      } else if (e.key === "Escape") {
        setShowGuide(false);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  if (!showGuide) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => setShowGuide(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="bg-surface border border-border rounded-xl shadow-2xl p-6 w-80 max-w-[90vw] animate-[zoom-in_0.18s_cubic-bezier(0.16,1,0.3,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-[15px] font-bold text-text m-0">Keyboard Shortcuts</h2>
          <button
            onClick={() => setShowGuide(false)}
            aria-label="Close shortcuts guide"
            className="text-text-3 hover:text-text cursor-pointer transition-colors bg-transparent border-none p-1 rounded hover:bg-surface-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {SHORTCUT_LABELS.map(({ keys, label }) => (
            <ShortcutItem key={label} keys={keys} label={label} />
          ))}
          <div className="h-px bg-border my-1" aria-hidden="true" />
          <ShortcutItem keys={["?"]} label="Toggle this guide" />
          <ShortcutItem keys={["Esc"]} label="Close" />
        </div>

        <p className="text-[11px] text-text-3 font-mono mt-5 text-center italic">
          Works with Cmd (Mac) or Ctrl (Windows/Linux)
        </p>
      </div>
    </div>
  );
}

function ShortcutItem({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[13px] text-text-2 font-medium">{label}</span>
      <div className="flex gap-1.5">
        {keys.map((key) => (
          <kbd
            key={key}
            className="bg-surface-2 border border-border-hi rounded px-1.5 py-0.5 text-[10px] font-mono text-text font-bold shadow-[0_1px_0_var(--border-hi)]"
          >
            {key}
          </kbd>
        ))}
      </div>
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────

export default function App() {
  const { setDockerOnline, dockerOnline } = useAppStore();

  // Initial Docker status check — don't wait 5 seconds for first health event
  useEffect(() => {
    ipc.testDockerConnection().then(() => setDockerOnline(true)).catch(() => setDockerOnline(false));
  }, [setDockerOnline]);

  // Listen to ongoing health monitor events
  useEffect(() => {
    let active = true;
    let unlistenFn: (() => void) | null = null;

    listen<{ online: boolean }>("app:dockerd-status", (event) => {
      if (active) setDockerOnline(event.payload.online);
    }).then((fn) => {
      if (!active) {
        fn();
      } else {
        unlistenFn = fn;
      }
    });

    return () => {
      active = false;
      if (unlistenFn) {
        try {
          unlistenFn();
        } catch (e) {
          console.error("Error unlistening app:dockerd-status:", e);
        }
      }
    };
  }, [setDockerOnline]);

  // Sync poll intervals from DB to localStorage for useQueries
  useEffect(() => {
    Promise.all([ipc.getSetting("poll_containers"), ipc.getSetting("poll_stats")]).then(
      ([c, s]) => {
        if (c) localStorage.setItem("poll_containers", c);
        if (s) localStorage.setItem("poll_stats", s);
      },
    ).catch(() => {});
  }, []);

  return (
    <ToastProvider>
      <DockerStatusBanner online={dockerOnline} />
      <KeyboardShortcuts />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
          <Route path="environments" element={<ErrorBoundary><Environments /></ErrorBoundary>} />
          <Route path="images" element={<ErrorBoundary><Images /></ErrorBoundary>} />
          <Route path="logs" element={<ErrorBoundary><Logs /></ErrorBoundary>} />
          <Route path="network" element={<ErrorBoundary><Network /></ErrorBoundary>} />
          <Route path="volumes" element={<ErrorBoundary><Volumes /></ErrorBoundary>} />
          <Route path="settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
        </Route>
      </Routes>
    </ToastProvider>
  );
}
