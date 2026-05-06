import { useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastProvider } from "./components/Toast";
import { Dashboard } from "./pages/Dashboard";
import { Environments } from "./pages/Environments";
import { Logs } from "./pages/Logs";
import { Network } from "./pages/Network";
import { Volumes } from "./pages/Volumes";
import { Settings } from "./pages/Settings";

function KeyboardShortcuts() {
  const navigate = useNavigate();
  useEffect(() => {
    const ROUTES: Record<string, string> = {
      "1": "/", "2": "/logs", "3": "/network", "4": "/environments", "5": "/settings",
    };
    function handler(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey) {
        if (ROUTES[e.key]) { e.preventDefault(); navigate(ROUTES[e.key]); }
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);
  return null;
}

export default function App() {
  return (
    <ToastProvider>
      <KeyboardShortcuts />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
          <Route path="environments" element={<ErrorBoundary><Environments /></ErrorBoundary>} />
          <Route path="logs" element={<ErrorBoundary><Logs /></ErrorBoundary>} />
          <Route path="network" element={<ErrorBoundary><Network /></ErrorBoundary>} />
          <Route path="volumes" element={<ErrorBoundary><Volumes /></ErrorBoundary>} />
          <Route path="settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
        </Route>
      </Routes>
    </ToastProvider>
  );
}
