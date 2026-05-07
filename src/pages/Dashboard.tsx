import { useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { useQueryClient } from "@tanstack/react-query";
import { useContainers, useContainerMutations, useHostStats, useNetworkTopology } from "../hooks/useQueries";
import { useModalClose } from "../hooks/useModalClose";
import { ipc, type ContainerInfo, type DockerEvent } from "../lib/ipc";
import { Skeleton } from "../components/Skeleton";
import { ContainerDetailsModal } from "../components/ContainerDetailsModal";
import { Link } from "react-router-dom";
import { cn } from "../lib/cn";

const STATE_MAP: Record<string, string> = {
  running:    "text-green bg-green-dim border-green-border",
  paused:     "text-orange bg-orange-dim border-orange-dim",
  restarting: "text-violet bg-violet-dim border-violet-dim",
  exited:     "text-text-3 bg-surface-2 border-border-hi",
  dead:       "text-error bg-error-dim border-error-dim",
  created:    "text-text-3 bg-surface-2 border-border-hi",
};

function StatusBadge({ state }: { state: string }) {
  const s = STATE_MAP[state] ?? STATE_MAP.exited;
  return (
    <span className={cn(
      "text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border",
      s
    )}>{state}</span>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="bg-surface-3 rounded h-1.5 overflow-hidden">
      <div
        className={cn("h-full transition-[width] duration-300", pct > 80 ? "bg-orange" : "bg-green")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

const containerRowActions = (color: string, bg: string) =>
  `text-[11px] px-2.5 py-0.5 rounded border border-${color.replace("var(--", "").replace(")", "")} bg-${bg.replace("var(--", "").replace(")", "")} cursor-pointer font-mono`;

function ContainerRow({ c, onStart, onStop, onRestart, onDetails }: {
  c: ContainerInfo;
  onStart: () => void; onStop: () => void; onRestart: () => void; onDetails: () => void;
}) {
  const running = c.state === "running";
  const canRestart = running || c.state === "paused";
  return (
    <tr className="border-b border-border-light">
      <td className="py-2.5 px-3">
        <button onClick={onDetails} className="bg-none border-none text-text font-medium cursor-pointer text-sm p-0 text-left">
          {c.name}
        </button>
      </td>
      <td className="py-2.5 px-3 text-text-3 font-mono text-xs">{c.image}</td>
      <td className="py-2.5 px-3"><StatusBadge state={c.state} /></td>
      <td className="py-2.5 px-3">
        <div className="flex gap-1.5">
          {!running && <button onClick={onStart} className="text-xs px-2.5 py-0.5 rounded border border-green-border bg-green-dim text-green cursor-pointer font-mono">Start</button>}
          {running && <button onClick={onStop} className="text-xs px-2.5 py-0.5 rounded border border-orange-dim bg-orange-dim text-orange cursor-pointer font-mono">Stop</button>}
          {canRestart && <button onClick={onRestart} className="text-xs px-2.5 py-0.5 rounded border border-violet-dim bg-violet-dim text-violet cursor-pointer font-mono">Restart</button>}
        </div>
      </td>
    </tr>
  );
}

export function Dashboard() {
  const qc = useQueryClient();
  const [paused, setPaused] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [events, setEvents] = useState<DockerEvent[]>([]);
  const [groupByCompose, setGroupByCompose] = useState(false);

  useEffect(() => {
    const handler = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  useEffect(() => {
    ipc.streamDockerEvents().catch(() => {});
    const unlisten = listen<DockerEvent>("docker-event", (e) => {
      setEvents((prev) => [e.payload, ...prev].slice(0, 20));
      if (e.payload.kind === "network") {
        qc.invalidateQueries({ queryKey: ["network-topology"] });
      }
    });
    return () => {
      unlisten.then((fn) => fn());
      ipc.stopDockerEvents().catch(() => {});
    };
  }, [qc]);

  const { data: containers, isLoading: cLoading, error: cError, isFetching } = useContainers(paused);
  const { start, stop, restart } = useContainerMutations();
  const { data: stats, isLoading: sLoading } = useHostStats(paused);
  const { data: networks } = useNetworkTopology();

  // Update tray menu with top-5 running containers whenever the list changes
  useEffect(() => {
    if (containers) ipc.updateTrayMenu(containers).catch(() => {});
  }, [containers]);

  const closeDetails = useCallback(() => setDetailsId(null), []);
  useModalClose(closeDetails);

  const runningCount = containers?.filter(c => c.state === "running").length ?? 0;
  const totalCount = containers?.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-text m-0">Dashboard</h1>

      {/* Host Stats */}
      <section className="bg-surface border border-border rounded-lg px-5 py-4">
        <h2 className={secTitle}>Host Resources</h2>
        {sLoading ? (
          <div className="grid grid-cols-3 gap-4">
            {[0,1,2].map(i => <div key={i}><Skeleton height={12} width="60%" /><div className="mt-2"><Skeleton height={6} /></div></div>)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-3 gap-4">
            <StatItem label="CPU" value={`${stats.cpu_percent.toFixed(1)}%`} pct={stats.cpu_percent} max={100} />
            <StatItem label="Memory" value={`${stats.mem_used_mb} / ${stats.mem_total_mb} MB`} pct={stats.mem_used_mb} max={stats.mem_total_mb} />
            <StatItem label="Disk" value={`${stats.disk_used_gb.toFixed(1)} / ${stats.disk_total_gb.toFixed(1)} GB`} pct={stats.disk_used_gb} max={stats.disk_total_gb} />
          </div>
        ) : null}
      </section>

      {/* Containers */}
      <section className="bg-surface border border-border rounded-lg px-5 py-4">
        <div className="flex items-center mb-4">
          <h2 className={cn(secTitle, "m-0 flex-1")}>Containers</h2>
          {!cLoading && containers && (
            <span className="text-xs font-mono text-text-3 mr-3">
                <span className="text-green">{runningCount}</span> running
              {" / "}
              <span className="text-text-2">{totalCount}</span> total
            </span>
          )}
          <button
            onClick={() => setGroupByCompose((v) => !v)}
            className={cn(
              "text-xs px-2.5 py-1 rounded border font-mono mr-2 cursor-pointer",
              groupByCompose
                ? "border-violet bg-violet-dim text-violet"
                : "border-border bg-surface-2 text-text-3"
            )}
          >
            Compose
          </button>
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ["containers"] })}
            disabled={isFetching}
            className={cn(
              "text-xs px-3 py-1 rounded border font-mono cursor-pointer",
              isFetching
                ? "border-border bg-surface-2 text-text-3 cursor-not-allowed"
                : "border-border bg-surface-2 text-text-2"
            )}
          >
            {isFetching ? "…" : "↻ Refresh"}
          </button>
        </div>

        {cLoading && <div className="flex flex-col gap-2.5">{[0,1,2].map(i => <Skeleton key={i} height={36} />)}</div>}
        {cError && <p className="text-error text-sm">Docker unavailable — is the daemon running?</p>}
        {containers && containers.length === 0 && <p className="text-text-3 text-sm">No containers found.</p>}
        {containers && containers.length > 0 && !groupByCompose && (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                {["Name", "Image", "Status", "Actions"].map(h => (
                  <th key={h} className="text-left py-1.5 px-3 text-[10px] font-mono uppercase tracking-wider text-text-3">{h}</th>
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
        {containers && containers.length > 0 && groupByCompose && (
          <ComposeGroupedView
            containers={containers}
            onStart={(id) => start.mutate(id)}
            onStop={(id) => stop.mutate(id)}
            onRestart={(id) => restart.mutate(id)}
            onDetails={setDetailsId}
          />
        )}
      </section>

      {/* Recent Events */}
      {events.length > 0 && (
        <section className="bg-surface border border-border rounded-lg px-5 py-4">
          <h2 className={secTitle}>Recent Events</h2>
          <div className="flex flex-col gap-1">
            {events.map((ev) => (
              <div key={`${ev.time}-${ev.actor}-${ev.action}`} className="flex gap-2.5 text-xs font-mono items-center">
                <span className="text-text-3 text-[10px] flex-shrink-0">{new Date(ev.time * 1000).toLocaleTimeString()}</span>
                <span className="text-orange">{ev.kind}</span>
                <span className="text-green">{ev.action}</span>
                <span className="text-text-2 overflow-hidden text-ellipsis whitespace-nowrap">{ev.actor}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Network Topology summary */}
      {networks && networks.length > 0 && (
        <section className="bg-surface border border-border rounded-lg px-5 py-4">
          <div className="flex items-center mb-4">
            <h2 className={cn(secTitle, "m-0 flex-1")}>Network Topology</h2>
            <Link to="/network" className="text-xs text-green font-mono no-underline">View all →</Link>
          </div>
          <div className="flex flex-col gap-2">
            {networks.map(net => (
              <div key={net.id} className="flex items-center gap-3">
                <span className="text-sm font-mono text-violet min-w-[120px]">{net.name}</span>
                <span className="text-xs text-text-3 font-mono">{net.driver}</span>
                <div className="flex gap-1.5 flex-wrap">
                  {net.containers.map(c => (
                    <span key={c.name} className="text-xs px-2 py-0.5 rounded-full bg-surface-2 text-text-2 border border-border-hi font-mono">{c.name}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {detailsId && <ContainerDetailsModal containerId={detailsId} onClose={closeDetails} />}
    </div>
  );
}

function StatItem({ label, value, pct, max }: { label: string; value: string; pct: number; max: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between">
        <span className="text-xs text-text-3 font-mono uppercase tracking-wider">{label}</span>
        <span className="text-sm text-text-2 font-mono">{value}</span>
      </div>
      <ProgressBar value={pct} max={max} />
    </div>
  );
}

function ComposeGroupedView({ containers, onStart, onStop, onRestart, onDetails }: {
  containers: ContainerInfo[];
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onRestart: (id: string) => void;
  onDetails: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const groups = containers.reduce<Record<string, ContainerInfo[]>>((acc, c) => {
    const key = c.compose_project ?? "__standalone__";
    (acc[key] ??= []).push(c);
    return acc;
  }, {});

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {Object.entries(groups).map(([project, items]) => {
        const isCollapsed = collapsed.has(project);
        const label = project === "__standalone__" ? "Standalone" : project;
        return (
          <div key={project} className="border border-border-light rounded-lg overflow-hidden">
            <button
              onClick={() => toggleGroup(project)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-surface-hi border-none cursor-pointer text-left"
            >
              <span className="text-xs text-text-3">{isCollapsed ? "▶" : "▼"}</span>
              <span className={cn(
                "text-sm font-semibold font-mono",
                project === "__standalone__" ? "text-text-3" : "text-violet"
              )}>{label}</span>
              <span className="text-xs text-text-3 font-mono">({items.length})</span>
            </button>
            {!isCollapsed && (
              <table className="w-full border-collapse">
                <tbody>
                  {items.map((c) => (
                    <ContainerRow key={c.id} c={c}
                      onStart={() => onStart(c.id)}
                      onStop={() => onStop(c.id)}
                      onRestart={() => onRestart(c.id)}
                      onDetails={() => onDetails(c.id)}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}

const secTitle = "text-[11px] font-mono uppercase tracking-widest text-text-3 mb-4";
