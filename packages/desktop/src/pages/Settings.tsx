import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ipc, type AppInfo } from "../lib/ipc";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/index";
import { ConfirmModal } from "../components/ui/Modal";
import { Select } from "../components/ui/index";

function SettingRow({
  label,
  sublabel,
  children,
}: {
  label: string;
  sublabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border-light last:border-0">
      <div>
        <div className="text-[13px] font-medium text-text">{label}</div>
        {sublabel && <div className="text-[11px] text-text-3 mt-0.5">{sublabel}</div>}
      </div>
      {children && <div className="ml-4 shrink-0">{children}</div>}
    </div>
  );
}

export function Settings() {
  const qc = useQueryClient();
  const [info, setInfo] = useState<AppInfo | null>(null);

  // Docker connection
  const [socketPath, setSocketPath] = useState("");
  const [connStatus, setConnStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testing, setTesting] = useState(false);

  // Polling intervals
  const { data: savedContainerInterval } = useQuery({
    queryKey: ["setting", "poll_containers"],
    queryFn: () => ipc.getSetting("poll_containers"),
    staleTime: Infinity,
  });
  const { data: savedStatsInterval } = useQuery({
    queryKey: ["setting", "poll_stats"],
    queryFn: () => ipc.getSetting("poll_stats"),
    staleTime: Infinity,
  });
  const [containerInterval, setContainerInterval] = useState(5000);
  const [statsInterval, setStatsInterval] = useState(3000);
  const [intervalSaved, setIntervalSaved] = useState(false);

  useEffect(() => {
    if (savedContainerInterval) setContainerInterval(Number(savedContainerInterval));
  }, [savedContainerInterval]);
  useEffect(() => {
    if (savedStatsInterval) setStatsInterval(Number(savedStatsInterval));
  }, [savedStatsInterval]);

  // Clear data
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);



  useEffect(() => {
    ipc.getAppInfo().then(setInfo).catch(() => {});
    ipc.getSetting("docker_socket").then((v) => { if (v) setSocketPath(v); }).catch(() => {});
  }, []);

  async function handleTestConnection() {
    setTesting(true);
    setConnStatus(null);
    try {
      const msg = await ipc.testDockerConnection(socketPath || undefined);
      // Persist the socket override so the next launch connects to it.
      // An empty value clears the override and reverts to platform defaults.
      await ipc.setSetting("docker_socket", socketPath.trim());
      setConnStatus({ ok: true, msg });
    } catch (e) {
      setConnStatus({ ok: false, msg: String(e) });
    } finally {
      setTesting(false);
    }
  }

  async function saveIntervals() {
    try {
      await Promise.all([
        ipc.setSetting("poll_containers", String(containerInterval)),
        ipc.setSetting("poll_stats", String(statsInterval)),
      ]);
      qc.invalidateQueries({ queryKey: ["setting", "poll_containers"] });
      qc.invalidateQueries({ queryKey: ["setting", "poll_stats"] });
      setIntervalSaved(true);
      setTimeout(() => setIntervalSaved(false), 2000);
    } catch (e) {
      console.error("Failed to persist poll intervals:", e);
    }
    qc.removeQueries({ queryKey: ["containers"] });
    qc.removeQueries({ queryKey: ["host-stats"] });
  }



  async function handleClearEnvVars() {
    setClearing(true);
    try {
      await ipc.clearAllEnvVars();
      qc.invalidateQueries({ queryKey: ["env-vars"] });
    } finally {
      setClearing(false);
      setConfirmClear(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 max-w-[600px]">
      <h1 className="text-[18px] font-bold text-text m-0">Settings</h1>

      {/* Docker Connection */}
      <Card>
        <div className="border-b border-border-light pb-3 mb-3">
          <span className="text-[11px] font-mono uppercase tracking-[1.2px] text-text-3">Docker Connection</span>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[11px] text-text-3 block mb-1.5">
              Socket path <span className="text-text-3/60">(leave blank for default)</span>
            </label>
            <div className="flex gap-2">
              <input
                value={socketPath}
                onChange={(e) => setSocketPath(e.target.value)}
                placeholder="/var/run/docker.sock"
                className="flex-1 bg-surface-2 border border-border rounded px-3 py-1.5 text-[12px] text-text font-mono outline-none focus:border-green focus:ring-1 focus:ring-green/30 transition-colors placeholder:text-text-3"
              />
              <Button onClick={handleTestConnection} loading={testing} variant="primary" size="sm">
                {testing ? "Testing" : "Test"}
              </Button>
            </div>
          </div>
          {connStatus && (
            <div
              className={`text-[12px] font-mono px-3 py-2 rounded border ${
                connStatus.ok
                  ? "text-green bg-green-dim border-green-border"
                  : "text-error bg-error-dim border-error-border"
              }`}
            >
              {connStatus.ok ? "✓ " : "✗ "}{connStatus.msg}
            </div>
          )}
        </div>
      </Card>

      {/* Polling Intervals */}
      <Card>
        <div className="border-b border-border-light pb-3 mb-1">
          <span className="text-[11px] font-mono uppercase tracking-[1.2px] text-text-3">Polling Intervals</span>
        </div>
        <SettingRow label="Container list" sublabel="How often to refresh the container list">
          <Select
            value={containerInterval}
            onChange={(e) => setContainerInterval(Number(e.target.value))}
            aria-label="Container polling interval"
          >
            {[2000, 5000, 10000, 30000].map((v) => (
              <option key={v} value={v}>{v / 1000}s</option>
            ))}
          </Select>
        </SettingRow>
        <SettingRow label="Host stats" sublabel="How often to refresh CPU / RAM / disk">
          <Select
            value={statsInterval}
            onChange={(e) => setStatsInterval(Number(e.target.value))}
            aria-label="Stats polling interval"
          >
            {[1000, 3000, 5000, 10000].map((v) => (
              <option key={v} value={v}>{v / 1000}s</option>
            ))}
          </Select>
        </SettingRow>
        <div className="flex items-center gap-3 mt-3">
          <Button onClick={saveIntervals} variant="primary" size="sm">
            Save intervals
          </Button>
          {intervalSaved && (
            <span className="text-[11px] text-green font-mono animate-[fade-in_0.2s_ease]">
              ✓ Saved
            </span>
          )}
        </div>
      </Card>

      {/* Data */}
      <Card>
        <div className="border-b border-border-light pb-3 mb-1">
          <span className="text-[11px] font-mono uppercase tracking-[1.2px] text-text-3">Data</span>
        </div>
        {info && (
          <SettingRow label="Database path">
            <span className="text-[11px] font-mono text-text-3 max-w-[260px] truncate" title={info.db_path}>
              {info.db_path}
            </span>
          </SettingRow>
        )}
        <SettingRow
          label="Clear all environment variables"
          sublabel="Permanently deletes all env vars across all scopes"
        >
          <Button variant="danger" size="sm" onClick={() => setConfirmClear(true)}>
            Clear all
          </Button>
        </SettingRow>
      </Card>

      {/* About */}
      <Card>
        <div className="border-b border-border-light pb-3 mb-1">
          <span className="text-[11px] font-mono uppercase tracking-[1.2px] text-text-3">About</span>
        </div>
        {[
          { label: "Version", value: info?.version ?? "…" },
          { label: "License", value: "MIT" },
          { label: "Source", value: "github.com/pallab-js/devlocal" },
        ].map(({ label, value }) => (
          <SettingRow key={label} label={label}>
            <span className="text-[12px] font-mono text-text-3">{value}</span>
          </SettingRow>
        ))}

      </Card>

      {/* Confirm clear modal */}
      <ConfirmModal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={handleClearEnvVars}
        title="Clear all env vars?"
        message="This will permanently delete every environment variable across all scopes. This action cannot be undone."
        confirmLabel="Clear all"
        variant="danger"
        loading={clearing}
      />
    </div>
  );
}
