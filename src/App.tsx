import { Routes, Route } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Dashboard } from "./pages/Dashboard";
import { Environments } from "./pages/Environments";
import { Logs } from "./pages/Logs";
import { Network } from "./pages/Network";
import { Settings } from "./pages/Settings";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
        <Route path="environments" element={<ErrorBoundary><Environments /></ErrorBoundary>} />
        <Route path="logs" element={<ErrorBoundary><Logs /></ErrorBoundary>} />
        <Route path="network" element={<ErrorBoundary><Network /></ErrorBoundary>} />
        <Route path="settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
      </Route>
    </Routes>
  );
}
