import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { check } from "@tauri-apps/plugin-updater";
import { useModalClose } from "../hooks/useModalClose";
import { ipc, type AppInfo } from "../lib/ipc";
import { useDbPoolStats } from "../hooks/useQueries";
import { cn } from "../lib/cn";

function Btn({
  children, onClick, color = "text-green", bg = "bg-green-dim", border = "border-green-border", disabled,
}: {
  children: React.ReactNode; onClick?: () => void;
  color?: string; bg?: string; border?: string; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "px-3.5 py-1 rounded border text-xs font-mono font-semibold transition-opacity",
        color, bg, border,
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      {children}
    </button>
  );
}

const secTitle = "text-[11px] font-mono uppercase tracking-widest text-text-3 mb-4 pb-2 border-b border-border-light";
const row = "flex items-center justify-between py-2 border-b border-border-light";
const label = "text-sm text-text font-medium";
const sublabel = "text-xs text-text-3 mt-0.5";
const card = "bg-surface border border-border rounded-lg px-5 py-4";
const input = "flex-1 bg-surface-2 border border-border rounded px-2.5 py-1.5 text-text text-xs font-mono outline-none";
const select = "bg-surface-2 border border-border rounded px-2 py-1 text-text text-xs font-mono outline-none disabled:opacity-50";

export function Settings() {
  const qc = useQueryClient();
  const [info, setInfo] = useState<AppInfo | null>(null);

  // Docker connection
  const [socketPath, setSocketPath] = useState("");
  const [connStatus, setConnStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testing, setTesting] = useState(false);

  // Polling intervals — persisted in DB, cached in localStorage for sync hook reads
  const [containerInterval, setContainerInterval] = useState(5000);
  const [statsInterval, setStatsInterval] = useState(3000);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load polling intervals from DB on mount
  useEffect(() => {
    Promise.all([
      ipc.getSetting("poll_containers"),
      ipc.getSetting("poll_stats"),
    ]).then(([ci, si]) => {
      const ciVal = ci ? Number(ci) : 5000;
      const siVal = si ? Number(si) : 3000;
      setContainerInterval(ciVal);
      setStatsInterval(siVal);
      localStorage.setItem("poll_containers", String(ciVal));
      localStorage.setItem("poll_stats", String(siVal));
      setSettingsLoaded(true);
    }).catch(() => {
      // Fallback to localStorage
      setContainerInterval(Number(localStorage.getItem("poll_containers") ?? 5000));
      setStatsInterval(Number(localStorage.getItem("poll_stats") ?? 3000));
      setSettingsLoaded(true);
    });
  }, []);

  // Clear data
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const poolStats = useDbPoolStats();

  const closeClearModal = useCallback(() => setConfirmClear(false), []);
  useModalClose(closeClearModal);

  // Updater
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);

  useEffect(() => {
    ipc.getAppInfo().then(setInfo).catch(() => {});
  }, []);

  async function handleTestConnection() {
    setTesting(true);
    setConnStatus(null);
    try {
      const msg = await ipc.testDockerConnection(socketPath || undefined);
      setConnStatus({ ok: true, msg });
    } catch (e) {
      setConnStatus({ ok: false, msg: String(e) });
    } finally {
      setTesting(false);
    }
  }

  async function saveIntervals() {
    localStorage.setItem("poll_containers", String(containerInterval));
    localStorage.setItem("poll_stats", String(statsInterval));
    try {
      await Promise.all([
        ipc.setSetting("poll_containers", String(containerInterval)),
        ipc.setSetting("poll_stats", String(statsInterval)),
      ]);
    } catch {
      // DB save failed — localStorage still has the values
    }
    qc.removeQueries({ queryKey: ["containers"] });
    qc.removeQueries({ queryKey: ["host-stats"] });
  }

  async function handleCheckUpdate() {
    setCheckingUpdate(true);
    setUpdateStatus(null);
    try {
      const update = await check();
      if (update?.available) {
        setUpdateStatus(`Update available: v${update.version}`);
        await update.downloadAndInstall();
      } else {
        setUpdateStatus("You are on the latest version.");
      }
    } catch {
      setUpdateStatus("Could not check for updates.");
    } finally {
      setCheckingUpdate(false);
    }
  }

  async function handleClearEnvVars() {    setClearing(true);
    try {
      await ipc.clearAllEnvVars();
      qc.invalidateQueries({ queryKey: ["env-vars"] });
    } finally {
      setClearing(false);
      setConfirmClear(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-[600px]">
      <h1 className="text-lg font-bold text-text m-0">Settings</h1>

      {/* Docker Connection */}
      <section className={card}>
        <h2 className={secTitle}>Docker Connection</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className={`${sublabel} block mb-1.5`}>
              Socket path (leave blank for default)
            </label>
            <div className="flex gap-2">
              <input
                value={socketPath}
                onChange={(e) => setSocketPath(e.target.value)}
                placeholder="/var/run/docker.sock"
                className={input}
              />
              <Btn onClick={handleTestConnection} disabled={testing}>
                {testing ? "Testing…" : "Test"}
              </Btn>
            </div>
          </div>
          {connStatus && (
            <div className={cn(
              "text-xs font-mono px-2.5 py-1.5 rounded",
              connStatus.ok
                ? "bg-green-dim text-green border-green-border"
                : "bg-error-dim text-error border border-error-dim"
            )}>
              {connStatus.ok ? "✓ " : "✗ "}{connStatus.msg}
            </div>
          )}
        </div>
      </section>

      {/* Polling Intervals */}
      <section className={card}>
        <h2 className={secTitle}>Polling Intervals</h2>
        <div className="flex flex-col">
          <div className={row}>
            <div>
              <div className={label}>Container list</div>
              <div className={sublabel}>How often to refresh the container list</div>
            </div>
            <select
              value={containerInterval}
              onChange={(e) => setContainerInterval(Number(e.target.value))}
              disabled={!settingsLoaded}
              className={select}
            >
              {[2000, 5000, 10000, 30000].map((v) => (
                <option key={v} value={v}>{v / 1000}s</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <div className={label}>Host stats</div>
              <div className={sublabel}>How often to refresh CPU / RAM / disk</div>
            </div>
            <select
              value={statsInterval}
              onChange={(e) => setStatsInterval(Number(e.target.value))}
              disabled={!settingsLoaded}
              className={select}
            >
              {[1000, 3000, 5000, 10000].map((v) => (
                <option key={v} value={v}>{v / 1000}s</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3">
          <Btn onClick={saveIntervals} disabled={!settingsLoaded}>{settingsLoaded ? "Save intervals" : "Loading…"}</Btn>
        </div>
      </section>

      {/* Data */}
      <section className={card}>
        <h2 className={secTitle}>Data</h2>
        <div className="flex flex-col">
          {info && (
            <div className={row}>
              <div>
                <div className={label}>Database path</div>
                <div className="text-xs text-text-3 font-mono mt-1">{info.db_path}</div>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between py-2">
            <div>
              <div className={label}>Clear all environment variables</div>
              <div className={sublabel}>Permanently deletes all env vars across all scopes</div>
            </div>
            <Btn
              onClick={() => setConfirmClear(true)}
              color="text-error" bg="bg-error-dim" border="border-error-dim"
            >
              Clear all
            </Btn>
          </div>
        </div>
      </section>

      {/* Database Health */}
      <section className={card}>
        <h2 className={secTitle}>Database Health</h2>
        <div className="flex flex-col">
          <div className="flex items-center justify-between py-2">
            <div>
              <div className={label}>Connection Pool</div>
              <div className={sublabel}>Total size / Idle connections</div>
            </div>
            {poolStats.data ? (
              <div className="text-sm font-mono text-text">
                {poolStats.data.size} / {poolStats.data.idle}
              </div>
            ) : (
              <div className="text-sm text-text-3">
                {poolStats.isLoading ? "Loading..." : "Error"}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* About */}
      <section className={card}>
        <h2 className={secTitle}>About</h2>
        <div className="flex flex-col">
          {[
            { label: "Version", value: info?.version ?? "…" },
            { label: "License", value: "MIT" },
            { label: "Source", value: "github.com/pallab-js/devlocal" },
          ].map(({ label: l, value }, i, arr) => (
            <div key={l} className={`flex items-center justify-between py-2 ${i < arr.length - 1 ? "border-b border-border-light" : ""}`}>
              <span className={label}>{l}</span>
              <span className="text-xs text-text-3 font-mono">{value}</span>
            </div>
          ))}
          <div className="flex items-center justify-between py-2 mt-2">
            <div>
              <div className={label}>Updates</div>
              {updateStatus && <div className={cn(sublabel, updateStatus.startsWith("Update") && "text-green")}>{updateStatus}</div>}
            </div>
            <Btn onClick={handleCheckUpdate} disabled={checkingUpdate}>
              {checkingUpdate ? "Checking…" : "Check for updates"}
            </Btn>
          </div>
        </div>
      </section>

      {/* Confirm clear dialog */}
      {confirmClear && (
        <div
          onClick={closeClearModal}
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]"
        >
          <div onClick={(e) => e.stopPropagation()} className="bg-surface border border-border rounded-xl p-6 w-[360px]">
            <p className="text-text text-sm font-semibold mb-2">Clear all env vars?</p>
            <p className="text-text-3 text-xs mb-5">
              This will permanently delete every environment variable across all scopes. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <Btn onClick={closeClearModal} color="text-text-2" bg="bg-surface-2" border="border-border">Cancel</Btn>
              <Btn onClick={handleClearEnvVars} disabled={clearing} color="text-error" bg="bg-error-dim" border="border-error-dim">
                {clearing ? "Clearing…" : "Clear all"}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
