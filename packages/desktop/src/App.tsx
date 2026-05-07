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

function DockerStatusBanner({ online }: { online: boolean }) {
  if (online) return null;

  return (
    <div className="bg-orange-500/10 border-b border-orange-500/20 py-2 px-4 flex items-center justify-center gap-2 animate-in slide-in-from-top duration-300">
      <span className="flex h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
      <span className="text-xs font-medium text-orange-500">
        Docker is offline. Some features may be unavailable.
      </span>
    </div>
  );
}
// ... (imports remain the same)
function KeyboardShortcuts() {
  const navigate = useNavigate();
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const ROUTES: Record<string, string> = {
      "1": "/",
      "2": "/logs",
      "3": "/environments",
      "4": "/network",
      "5": "/settings",
    };
    function handler(e: KeyboardEvent) {
      // Don't trigger if user is typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.metaKey || e.ctrlKey) {
        if (ROUTES[e.key]) {
          e.preventDefault();
          navigate(ROUTES[e.key]);
          setShowGuide(false);
        }
      } else if (e.key === "?") {
        e.preventDefault();
        setShowGuide(prev => !prev);
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
    >
      <div 
        className="bg-surface border border-border rounded-xl shadow-2xl p-6 w-80 max-w-[90vw] animate-in fade-in zoom-in duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-text m-0">Keyboard Shortcuts</h2>
          <button 
            onClick={() => setShowGuide(false)}
            className="text-text-3 hover:text-text cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <ShortcutItem keys={["Cmd", "1"]} label="Dashboard" />
          <ShortcutItem keys={["Cmd", "2"]} label="Logs" />
          <ShortcutItem keys={["Cmd", "3"]} label="Environments" />
          <ShortcutItem keys={["Cmd", "4"]} label="Network" />
          <ShortcutItem keys={["Cmd", "5"]} label="Settings" />
          <div className="h-px bg-border my-1" />
          <ShortcutItem keys={["?"]} label="Show Shortcuts" />
          <ShortcutItem keys={["Esc"]} label="Close" />
        </div>

        <p className="text-[11px] text-text-3 font-mono mt-6 text-center italic">
          Tip: Use shortcuts to jump between views
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
        {keys.map(key => (
          <kbd key={key} className="bg-surface-2 border border-border-hi rounded px-1.5 py-0.5 text-[10px] font-mono text-text font-bold shadow-[0_1px_0_var(--border-hi)]">
            {key}
          </kbd>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [dockerOnline, setDockerOnline] = useState(true);

  useEffect(() => {
    const unlisten = listen<{ online: boolean }>("app:dockerd-status", (event) => {
      setDockerOnline(event.payload.online);
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

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
