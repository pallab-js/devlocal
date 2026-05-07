import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { check } from "@tauri-apps/plugin-updater";
import { ipc, type AppInfo } from "../lib/ipc";

const card: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "1rem 1.25rem",
};

const secTitle: React.CSSProperties = {
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  textTransform: "uppercase",
  letterSpacing: "1.2px",
  color: "var(--text-3)",
  margin: "0 0 1rem 0",
  paddingBottom: "0.5rem",
  borderBottom: "1px solid var(--border-light)",
};

const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 0",
  borderBottom: "1px solid var(--border-light)",
};

const label: React.CSSProperties = {
  fontSize: 13,
  color: "var(--text)",
  fontWeight: 500,
};

const sublabel: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-3)",
  marginTop: 2,
};

function Btn({
  children, onClick, color = "var(--green)", bg = "var(--green-dim)", border = "var(--green-border)", disabled,
}: {
  children: React.ReactNode; onClick?: () => void;
  color?: string; bg?: string; border?: string; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "5px 14px", borderRadius: 4, border: `1px solid ${border}`,
        background: bg, color, cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 600,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function Settings() {
  const qc = useQueryClient();
  const [info, setInfo] = useState<AppInfo | null>(null);

  // Docker connection
  const [socketPath, setSocketPath] = useState("");
  const [connStatus, setConnStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testing, setTesting] = useState(false);

  // Polling intervals (stored in localStorage, read by useQueries via custom event)
  const [containerInterval, setContainerInterval] = useState(() =>
    Number(localStorage.getItem("poll_containers") ?? 5000)
  );
  const [statsInterval, setStatsInterval] = useState(() =>
    Number(localStorage.getItem("poll_stats") ?? 3000)
  );

  // Clear data
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

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
    } catch (e) {
      console.error("Failed to persist poll intervals to DB:", e);
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
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 600 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", margin: 0 }}>Settings</h1>

      {/* Docker Connection */}
      <section style={card}>
        <h2 style={secTitle}>Docker Connection</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ ...sublabel, display: "block", marginBottom: 6 }}>
              Socket path (leave blank for default)
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={socketPath}
                onChange={(e) => setSocketPath(e.target.value)}
                placeholder="/var/run/docker.sock"
                style={{
                  flex: 1, background: "var(--surface-2)", border: "1px solid var(--border)",
                  borderRadius: 4, padding: "6px 10px", color: "var(--text)",
                  fontSize: 12, fontFamily: "var(--font-mono)", outline: "none",
                }}
              />
              <Btn onClick={handleTestConnection} disabled={testing}>
                {testing ? "Testing…" : "Test"}
              </Btn>
            </div>
          </div>
          {connStatus && (
            <div style={{
              fontSize: 12, fontFamily: "var(--font-mono)", padding: "6px 10px", borderRadius: 4,
              background: connStatus.ok ? "var(--green-dim)" : "var(--error-dim)",
              color: connStatus.ok ? "var(--green)" : "var(--error)",
              border: `1px solid ${connStatus.ok ? "var(--green-border)" : "rgba(255,180,171,0.3)"}`,
            }}>
              {connStatus.ok ? "✓ " : "✗ "}{connStatus.msg}
            </div>
          )}
        </div>
      </section>

      {/* Polling Intervals */}
      <section style={card}>
        <h2 style={secTitle}>Polling Intervals</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <div style={row}>
            <div>
              <div style={label}>Container list</div>
              <div style={sublabel}>How often to refresh the container list</div>
            </div>
            <select
              value={containerInterval}
              onChange={(e) => setContainerInterval(Number(e.target.value))}
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 4, padding: "5px 8px", color: "var(--text)", fontSize: 12, fontFamily: "var(--font-mono)", outline: "none" }}
            >
              {[2000, 5000, 10000, 30000].map((v) => (
                <option key={v} value={v}>{v / 1000}s</option>
              ))}
            </select>
          </div>
          <div style={{ ...row, borderBottom: "none" }}>
            <div>
              <div style={label}>Host stats</div>
              <div style={sublabel}>How often to refresh CPU / RAM / disk</div>
            </div>
            <select
              value={statsInterval}
              onChange={(e) => setStatsInterval(Number(e.target.value))}
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 4, padding: "5px 8px", color: "var(--text)", fontSize: 12, fontFamily: "var(--font-mono)", outline: "none" }}
            >
              {[1000, 3000, 5000, 10000].map((v) => (
                <option key={v} value={v}>{v / 1000}s</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Btn onClick={saveIntervals}>Save intervals</Btn>
        </div>
      </section>

      {/* Data */}
      <section style={card}>
        <h2 style={secTitle}>Data</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {info && (
            <div style={row}>
              <div>
                <div style={label}>Database path</div>
                <div style={{ ...sublabel, fontFamily: "var(--font-mono)", marginTop: 4 }}>{info.db_path}</div>
              </div>
            </div>
          )}
          <div style={{ ...row, borderBottom: "none" }}>
            <div>
              <div style={label}>Clear all environment variables</div>
              <div style={sublabel}>Permanently deletes all env vars across all scopes</div>
            </div>
            <Btn
              onClick={() => setConfirmClear(true)}
              color="var(--error)" bg="var(--error-dim)" border="rgba(255,180,171,0.3)"
            >
              Clear all
            </Btn>
          </div>
        </div>
      </section>

      {/* About */}
      <section style={card}>
        <h2 style={secTitle}>About</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {[
            { label: "Version", value: info?.version ?? "…" },
            { label: "License", value: "MIT" },
            { label: "Source", value: "github.com/pallab-js/devlocal" },
          ].map(({ label: l, value }, i, arr) => (
            <div key={l} style={{ ...row, borderBottom: i < arr.length - 1 ? "1px solid var(--border-light)" : "none" }}>
              <span style={label}>{l}</span>
              <span style={{ fontSize: 12, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>{value}</span>
            </div>
          ))}
          <div style={{ ...row, borderBottom: "none", marginTop: 8 }}>
            <div>
              <div style={label}>Updates</div>
              {updateStatus && <div style={{ ...sublabel, color: updateStatus.startsWith("Update") ? "var(--green)" : "var(--text-3)" }}>{updateStatus}</div>}
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
          onClick={() => setConfirmClear(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "1.5rem", width: 360 }}>
            <p style={{ color: "var(--text)", fontSize: 14, fontWeight: 600, margin: "0 0 8px" }}>Clear all env vars?</p>
            <p style={{ color: "var(--text-3)", fontSize: 13, margin: "0 0 1.25rem" }}>
              This will permanently delete every environment variable across all scopes. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn onClick={() => setConfirmClear(false)} color="var(--text-2)" bg="var(--surface-2)" border="var(--border)">Cancel</Btn>
              <Btn onClick={handleClearEnvVars} disabled={clearing} color="var(--error)" bg="var(--error-dim)" border="rgba(255,180,171,0.3)">
                {clearing ? "Clearing…" : "Clear all"}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
