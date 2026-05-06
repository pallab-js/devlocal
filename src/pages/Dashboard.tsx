import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useQueryClient } from "@tanstack/react-query";
import { useContainers, useContainerMutations, useHostStats, useNetworkTopology } from "../hooks/useQueries";
import { ipc, type ContainerInfo, type DockerEvent } from "../lib/ipc";
import { Skeleton } from "../components/Skeleton";
import { ContainerDetailsModal } from "../components/ContainerDetailsModal";
import { Link } from "react-router-dom";

const STATE_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  running:    { color: "var(--green)",  bg: "var(--green-dim)",   border: "var(--green-border)" },
  paused:     { color: "var(--orange)", bg: "var(--orange-dim)",  border: "rgba(255,160,114,0.3)" },
  restarting: { color: "var(--violet)", bg: "var(--violet-dim)",  border: "rgba(130,110,220,0.3)" },
  exited:     { color: "var(--text-3)", bg: "var(--surface-2)",   border: "var(--border-hi)" },
  dead:       { color: "var(--error)",  bg: "var(--error-dim)",   border: "rgba(255,180,171,0.3)" },
  created:    { color: "var(--text-3)", bg: "var(--surface-2)",   border: "var(--border-hi)" },
};

function StatusBadge({ state }: { state: string }) {
  const s = STATE_STYLE[state] ?? STATE_STYLE.exited;
  return (
    <span style={{
      fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.8px",
      padding: "2px 8px", borderRadius: 9999,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>{state}</span>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ background: "var(--surface-3)", borderRadius: 4, height: 6, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: pct > 80 ? "var(--orange)" : "var(--green)", transition: "width 0.3s" }} />
    </div>
  );
}

function ContainerRow({ c, onStart, onStop, onRestart, onDetails }: {
  c: ContainerInfo;
  onStart: () => void; onStop: () => void; onRestart: () => void; onDetails: () => void;
}) {
  const running = c.state === "running";
  const canRestart = running || c.state === "paused";
  return (
    <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
      <td style={{ padding: "10px 12px" }}>
        <button onClick={onDetails} style={{ background: "none", border: "none", color: "var(--text)", fontWeight: 500, cursor: "pointer", fontSize: 13, padding: 0, textAlign: "left" }}>
          {c.name}
        </button>
      </td>
      <td style={{ padding: "10px 12px", color: "var(--text-3)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{c.image}</td>
      <td style={{ padding: "10px 12px" }}><StatusBadge state={c.state} /></td>
      <td style={{ padding: "10px 12px" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {!running && <button onClick={onStart} style={btn("var(--green)", "var(--green-dim)")}>Start</button>}
          {running && <button onClick={onStop} style={btn("var(--orange)", "var(--orange-dim)")}>Stop</button>}
          {canRestart && <button onClick={onRestart} style={btn("var(--violet)", "var(--violet-dim)")}>Restart</button>}
        </div>
      </td>
    </tr>
  );
}

function btn(color: string, bg: string): React.CSSProperties {
  return { fontSize: 11, padding: "3px 10px", borderRadius: 4, border: `1px solid ${color}`, background: bg, color, cursor: "pointer", fontFamily: "var(--font-mono)" };
}

export function Dashboard() {
  const qc = useQueryClient();
  const [paused, setPaused] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [events, setEvents] = useState<DockerEvent[]>([]);

  useEffect(() => {
    const handler = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  useEffect(() => {
    ipc.streamDockerEvents().catch(() => {});
    const unlisten = listen<DockerEvent>("docker-event", (e) => {
      setEvents((prev) => [e.payload, ...prev].slice(0, 20));
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const { data: containers, isLoading: cLoading, error: cError, isFetching } = useContainers(paused);
  const { start, stop, restart } = useContainerMutations();
  const { data: stats, isLoading: sLoading } = useHostStats(paused);
  const { data: networks } = useNetworkTopology(paused);

  const runningCount = containers?.filter(c => c.state === "running").length ?? 0;
  const totalCount = containers?.length ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", margin: 0 }}>Dashboard</h1>

      {/* Host Stats */}
      <section style={card}>
        <h2 style={secTitle}>Host Resources</h2>
        {sLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            {[0,1,2].map(i => <div key={i}><Skeleton height={12} width="60%" /><div style={{marginTop:8}}><Skeleton height={6} /></div></div>)}
          </div>
        ) : stats ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            <StatItem label="CPU" value={`${stats.cpu_percent.toFixed(1)}%`} pct={stats.cpu_percent} max={100} />
            <StatItem label="Memory" value={`${stats.mem_used_mb} / ${stats.mem_total_mb} MB`} pct={stats.mem_used_mb} max={stats.mem_total_mb} />
            <StatItem label="Disk" value={`${stats.disk_used_gb.toFixed(1)} / ${stats.disk_total_gb.toFixed(1)} GB`} pct={stats.disk_used_gb} max={stats.disk_total_gb} />
          </div>
        ) : null}
      </section>

      {/* Containers */}
      <section style={card}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ ...secTitle, margin: 0, flex: 1 }}>Containers</h2>
          {/* Count summary */}
          {!cLoading && containers && (
            <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-3)", marginRight: 12 }}>
              <span style={{ color: "var(--green)" }}>{runningCount}</span> running
              {" / "}
              <span style={{ color: "var(--text-2)" }}>{totalCount}</span> total
            </span>
          )}
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ["containers"] })}
            disabled={isFetching}
            style={{ fontSize: 11, padding: "4px 12px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface-2)", color: isFetching ? "var(--text-3)" : "var(--text-2)", cursor: isFetching ? "not-allowed" : "pointer", fontFamily: "var(--font-mono)" }}
          >
            {isFetching ? "…" : "↻ Refresh"}
          </button>
        </div>

        {cLoading && <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{[0,1,2].map(i => <Skeleton key={i} height={36} />)}</div>}
        {cError && <p style={{ color: "var(--error)", fontSize: 13 }}>Docker unavailable — is the daemon running?</p>}
        {containers && containers.length === 0 && <p style={{ color: "var(--text-3)", fontSize: 13 }}>No containers found.</p>}
        {containers && containers.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Name", "Image", "Status", "Actions"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "6px 12px", fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-3)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {containers.map(c => (
                <ContainerRow key={c.id} c={c}
                  onStart={() => start.mutate(c.id)}
                  onStop={() => stop.mutate(c.id)}
                  onRestart={() => restart.mutate(c.id)}
                  onDetails={() => setDetailsId(c.id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Recent Events */}
      {events.length > 0 && (
        <section style={card}>
          <h2 style={secTitle}>Recent Events</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {events.map((ev) => (
              <div key={`${ev.time}-${ev.actor}-${ev.action}`} style={{ display: "flex", gap: 10, fontSize: 12, fontFamily: "var(--font-mono)", alignItems: "center" }}>
                <span style={{ color: "var(--text-3)", fontSize: 10, flexShrink: 0 }}>{new Date(ev.time * 1000).toLocaleTimeString()}</span>
                <span style={{ color: "var(--orange)" }}>{ev.kind}</span>
                <span style={{ color: "var(--green)" }}>{ev.action}</span>
                <span style={{ color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.actor}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Network Topology summary */}
      {networks && networks.length > 0 && (
        <section style={card}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ ...secTitle, margin: 0, flex: 1 }}>Network Topology</h2>
            <Link to="/network" style={{ fontSize: 11, color: "var(--green)", fontFamily: "var(--font-mono)", textDecoration: "none" }}>View all →</Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {networks.map(net => (
              <div key={net.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--violet)", minWidth: 120 }}>{net.name}</span>
                <span style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>{net.driver}</span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {net.containers.map(c => (
                    <span key={c.name} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 9999, background: "var(--surface-2)", color: "var(--text-2)", border: "1px solid var(--border-hi)", fontFamily: "var(--font-mono)" }}>{c.name}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {detailsId && <ContainerDetailsModal containerId={detailsId} onClose={() => setDetailsId(null)} />}
    </div>
  );
}

function StatItem({ label, value, pct, max }: { label: string; value: string; pct: number; max: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.8px" }}>{label}</span>
        <span style={{ fontSize: 12, color: "var(--text-2)", fontFamily: "var(--font-mono)" }}>{value}</span>
      </div>
      <ProgressBar value={pct} max={max} />
    </div>
  );
}

const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "1rem 1.25rem" };
const secTitle: React.CSSProperties = { fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "1.2px", color: "var(--text-3)", margin: "0 0 1rem 0" };
