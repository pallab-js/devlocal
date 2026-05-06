import { useEffect, useState, useRef, useMemo } from "react";
import { listen } from "@tauri-apps/api/event";
import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useContainers, useContainerMutations, useHostStats, useNetworkTopology } from "../hooks/useQueries";
import { ipc, type ContainerInfo, type DockerEvent } from "../lib/ipc";
import { Skeleton } from "../components/Skeleton";
import { ContainerDetailsModal } from "../components/ContainerDetailsModal";
import { Link } from "react-router-dom";
import { useDebounce } from "../hooks/useDebounce";

const STATE_CONFIG: Record<string, string> = {
  running:    "text-green bg-green/10 border-green/30",
  paused:     "text-orange bg-orange/10 border-orange/30",
  restarting: "text-violet bg-violet/10 border-violet/30",
  exited:     "text-text-3 bg-surface-2 border-border-hi",
  dead:       "text-error bg-error/10 border-error/30",
  created:    "text-text-3 bg-surface-2 border-border-hi",
};

function StatusBadge({ state }: { state: string }) {
  const config = STATE_CONFIG[state] ?? STATE_CONFIG.exited;
  return (
    <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border ${config}`}>
      {state}
    </span>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const colorClass = pct > 80 ? "bg-orange" : "bg-green";
  return (
    <div className="bg-surface-3 rounded h-1.5 overflow-hidden">
      <div
        className={`h-full transition-all duration-300 ${colorClass}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

const btnBase = "text-[11px] px-2.5 py-1 rounded border font-mono cursor-pointer transition-colors";
const btnGreen = `${btnBase} text-green bg-green/10 border-green hover:bg-green/20`;
const btnOrange = `${btnBase} text-orange bg-orange/10 border-orange hover:bg-orange/20`;
const btnViolet = `${btnBase} text-violet bg-violet/10 border-violet hover:bg-violet/20`;

function ContainerRow({ c, onStart, onStop, onRestart, onDetails, style }: {
  c: ContainerInfo;
  onStart: () => void; onStop: () => void; onRestart: () => void; onDetails: () => void;
  style?: React.CSSProperties;
}) {
  const running = c.state === "running";
  const canRestart = running || c.state === "paused";
  return (
    <tr className="border-b border-border-light hover:bg-surface-hi/50 transition-colors flex w-full" style={style}>
      <td className="p-3 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
        <button onClick={onDetails} className="bg-transparent border-none text-text font-medium cursor-pointer text-[13px] p-0 text-left hover:text-green transition-colors w-full overflow-hidden text-ellipsis whitespace-nowrap">
          {c.name}
        </button>
      </td>
      <td className="p-3 flex-1 text-text-3 font-mono text-[12px] overflow-hidden text-ellipsis whitespace-nowrap">{c.image}</td>
      <td className="p-3 w-32 shrink-0"><StatusBadge state={c.state} /></td>
      <td className="p-3 w-48 shrink-0">
        <div className="flex gap-1.5">
          {!running && <button onClick={onStart} className={btnGreen}>Start</button>}
          {running && <button onClick={onStop} className={btnOrange}>Stop</button>}
          {canRestart && <button onClick={onRestart} className={btnViolet}>Restart</button>}
        </div>
      </td>
    </tr>
  );
}

const cardClass = "bg-surface border border-border rounded-lg p-4 md:p-5";
const secTitleClass = "text-[11px] font-mono uppercase tracking-[1.2px] text-text-3 mb-4 block";

export function Dashboard() {
  const qc = useQueryClient();
  const [paused, setPaused] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [events, setEvents] = useState<DockerEvent[]>([]);
  const [groupByCompose, setGroupByCompose] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const parentRef = useRef<HTMLDivElement>(null);

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
    return () => { unlisten.then((fn) => fn()); };
  }, [qc]);

  const { data: containers, isLoading: cLoading, error: cError, isFetching } = useContainers(paused);
  const { start, stop, restart } = useContainerMutations();
  const { data: stats, isLoading: sLoading } = useHostStats(paused);
  const { data: networks } = useNetworkTopology();

  const filteredContainers = useMemo(() => {
    if (!containers) return [];
    if (!debouncedSearch) return containers;
    const s = debouncedSearch.toLowerCase();
    return containers.filter(c => 
      c.name.toLowerCase().includes(s) || 
      c.image.toLowerCase().includes(s) ||
      (c.compose_project && c.compose_project.toLowerCase().includes(s))
    );
  }, [containers, debouncedSearch]);

  const rowVirtualizer = useVirtualizer({
    count: filteredContainers.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 49, // Height of ContainerRow with padding
    overscan: 10,
  });

  const runningCount = containers?.filter(c => c.state === "running").length ?? 0;
  const totalCount = containers?.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[18px] font-bold text-text m-0">Dashboard</h1>

      {/* Host Stats */}
      <section className={cardClass}>
        <h2 className={secTitleClass}>Host Resources</h2>
        {sLoading ? (
          <div className="grid grid-cols-3 gap-4">
            {[0,1,2].map(i => <div key={i}><Skeleton height={12} width="60%" /><div className="mt-2"><Skeleton height={6} /></div></div>)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatItem label="CPU" value={`${stats.cpu_percent.toFixed(1)}%`} pct={stats.cpu_percent} max={100} />
            <StatItem label="Memory" value={`${stats.mem_used_mb} / ${stats.mem_total_mb} MB`} pct={stats.mem_used_mb} max={stats.mem_total_mb} />
            <StatItem label="Disk" value={`${stats.disk_used_gb.toFixed(1)} / ${stats.disk_total_gb.toFixed(1)} GB`} pct={stats.disk_used_gb} max={stats.disk_total_gb} />
          </div>
        ) : null}
      </section>

      {/* Containers */}
      <section className={cardClass}>
        <div className="flex items-center mb-4">
          <h2 className={`${secTitleClass} m-0 flex-1`}>Containers</h2>
          {/* Count summary */}
          {!cLoading && containers && (
            <span className="text-[11px] font-mono text-text-3 mr-3">
              <span className="text-green">{runningCount}</span> running
              {" / "}
              <span className="text-text-2">{totalCount}</span> total
            </span>
          )}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search containers…"
            className="text-[11px] px-2.5 py-1 rounded border border-border bg-surface-2 text-text font-mono outline-none mr-2 w-40 focus:border-green focus:ring-1 focus:ring-green/30"
          />
          <button
            onClick={() => setGroupByCompose((v) => !v)}
            className={`text-[11px] px-2.5 py-1 rounded border font-mono cursor-pointer mr-2 transition-colors ${groupByCompose ? "border-violet bg-violet/10 text-violet" : "border-border bg-surface-2 text-text-3 hover:bg-surface-3"}`}
          >
            Compose
          </button>
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ["containers"] })}
            disabled={isFetching}
            className={`text-[11px] px-3 py-1 rounded border border-border bg-surface-2 font-mono transition-colors ${isFetching ? "text-text-3 cursor-not-allowed" : "text-text-2 cursor-pointer hover:bg-surface-3"}`}
          >
            {isFetching ? "…" : "↻ Refresh"}
          </button>
        </div>

        {cLoading && <div className="flex flex-col gap-2.5">{[0,1,2].map(i => <Skeleton key={i} height={36} />)}</div>}
        {cError && <p className="text-error text-[13px]">Docker unavailable — is the daemon running?</p>}
        {containers && containers.length === 0 && <p className="text-text-3 text-[13px]">No containers found.</p>}
        {containers && containers.length > 0 && filteredContainers.length === 0 && <p className="text-text-3 text-[13px]">No containers match your search.</p>}
        {filteredContainers && filteredContainers.length > 0 && !groupByCompose && (
          <div 
            ref={parentRef}
            className="overflow-y-auto max-h-[600px] border border-border rounded-md"
          >
            <table className="w-full border-collapse table-fixed">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="border-b border-border flex w-full">
                  <th className="text-left p-3 pt-1 text-[10px] font-mono uppercase tracking-wider text-text-3 flex-1">Name</th>
                  <th className="text-left p-3 pt-1 text-[10px] font-mono uppercase tracking-wider text-text-3 flex-1">Image</th>
                  <th className="text-left p-3 pt-1 text-[10px] font-mono uppercase tracking-wider text-text-3 w-32 shrink-0">Status</th>
                  <th className="text-left p-3 pt-1 text-[10px] font-mono uppercase tracking-wider text-text-3 w-48 shrink-0">Actions</th>
                </tr>
              </thead>
              <tbody 
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const c = filteredContainers[virtualRow.index];
                  return (
                    <ContainerRow 
                      key={c.id} 
                      c={c}
                      onStart={() => start.mutate(c.id)}
                      onStop={() => stop.mutate(c.id)}
                      onRestart={() => restart.mutate(c.id)}
                      onDetails={() => setDetailsId(c.id)}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {containers && containers.length > 0 && filteredContainers.length > 0 && groupByCompose && (
          <ComposeGroupedView
            containers={filteredContainers}
            onStart={(id) => start.mutate(id)}
            onStop={(id) => stop.mutate(id)}
            onRestart={(id) => restart.mutate(id)}
            onDetails={setDetailsId}
          />
        )}
      </section>

      {/* Recent Events */}
      {events.length > 0 && (
        <section className={cardClass}>
          <h2 className={secTitleClass}>Recent Events</h2>
          <div className="flex flex-col gap-1">
            {events.map((ev) => (
              <div key={`${ev.time}-${ev.actor}-${ev.action}`} className="flex gap-2.5 text-[12px] font-mono items-center">
                <span className="text-text-3 text-[10px] shrink-0">{new Date(ev.time * 1000).toLocaleTimeString()}</span>
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
        <section className={cardClass}>
          <div className="flex items-center mb-4">
            <h2 className={`${secTitleClass} m-0 flex-1`}>Network Topology</h2>
            <Link to="/network" className="text-[11px] color-green font-mono no-underline hover:underline">View all →</Link>
          </div>
          <div className="flex flex-col gap-2">
            {networks.map(net => (
              <div key={net.id} className="flex items-center gap-3">
                <span className="text-[12px] font-mono text-violet min-w-[120px]">{net.name}</span>
                <span className="text-[10px] text-text-3 font-mono">{net.driver}</span>
                <div className="flex gap-1.5 flex-wrap">
                  {net.containers.map(c => (
                    <span key={c.name} className="text-[11px] px-2 py-0.5 rounded-full bg-surface-2 text-text-2 border border-border-hi font-mono">{c.name}</span>
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
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between">
        <span className="text-[11px] text-text-3 font-mono uppercase tracking-wider">{label}</span>
        <span className="text-[12px] text-text-2 font-mono">{value}</span>
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
  const parentRef = useRef<HTMLDivElement>(null);

  const groups = containers.reduce<Record<string, ContainerInfo[]>>((acc, c) => {
    const key = c.compose_project ?? "__standalone__";
    (acc[key] ??= []).push(c);
    return acc;
  }, {});

  const flattenedData = Object.entries(groups).flatMap(([project, items]) => {
    const isCollapsed = collapsed.has(project);
    const header = { type: 'header' as const, project, count: items.length };
    if (isCollapsed) return [header];
    return [header, ...items.map(item => ({ type: 'item' as const, item }))];
  });

  const rowVirtualizer = useVirtualizer({
    count: flattenedData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => flattenedData[index].type === 'header' ? 42 : 49,
    overscan: 10,
  });

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
    <div 
      ref={parentRef}
      className="overflow-y-auto max-h-[600px] border border-border rounded-md"
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const data = flattenedData[virtualRow.index];
          
          if (data.type === 'header') {
            const { project, count } = data;
            const isCollapsed = collapsed.has(project);
            const label = project === "__standalone__" ? "Standalone" : project;
            return (
              <div
                key={`header-${project}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="bg-surface-hi border-b border-border-light flex items-center px-3 z-10"
              >
                <button
                  onClick={() => toggleGroup(project)}
                  className="w-full flex items-center gap-2 bg-transparent border-none cursor-pointer text-left hover:bg-surface-2 transition-colors py-1"
                >
                  <span className="text-[10px] text-text-3">{isCollapsed ? "▶" : "▼"}</span>
                  <span className={`text-[12px] font-semibold font-mono ${project === "__standalone__" ? "text-text-3" : "text-violet"}`}>{label}</span>
                  <span className="text-[10px] text-text-3 font-mono">({count})</span>
                </button>
              </div>
            );
          }

          const { item: c } = data;
          return (
            <div
              key={c.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <table className="w-full border-collapse table-fixed">
                <tbody>
                  <ContainerRow 
                    c={c}
                    onStart={() => onStart(c.id)}
                    onStop={() => onStop(c.id)}
                    onRestart={() => onRestart(c.id)}
                    onDetails={() => onDetails(c.id)}
                  />
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
