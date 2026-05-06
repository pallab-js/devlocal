import { useEffect, useState } from "react";
import { ipc, type ContainerDetails, type ContainerStats } from "../lib/ipc";

interface Props {
  containerId: string;
  onClose: () => void;
}

export function ContainerDetailsModal({ containerId, onClose }: Props) {
  const [details, setDetails] = useState<ContainerDetails | null>(null);
  const [stats, setStats] = useState<ContainerStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ipc.inspectContainer(containerId)
      .then(setDetails)
      .catch((e) => setError(String(e)));
    ipc.getContainerStats(containerId)
      .then(setStats)
      .catch(() => {}); // stats may fail for stopped containers
  }, [containerId]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border border-border rounded-xl p-6 w-full max-w-[520px] max-h-[85vh] overflow-auto shadow-2xl"
      >
        <div className="flex justify-between items-center mb-4">
          <span className="font-bold text-text text-[15px]">
            {details?.name ?? "Container Details"}
          </span>
          <button onClick={onClose} className="bg-transparent border-none text-text-3 cursor-pointer text-xl leading-none hover:text-text transition-colors">×</button>
        </div>

        {error && <p className="text-error text-[13px]">{error}</p>}
        {!details && !error && <p className="text-text-3 text-[13px]">Loading…</p>}

        {details && (
          <div className="flex flex-col gap-3">
            <Row label="Image" value={details.image} />
            <Row label="State" value={details.state} />
            <Row label="Ports" value={details.ports.join(", ") || "—"} />
            <Row label="Mounts" value={details.mounts.join(", ") || "—"} />
            <Row label="Command" value={details.cmd.join(" ") || "—"} />

            {/* Feature 7.1: per-container stats */}
            {stats && (
              <div className="mt-2">
                <div className={labelClass}>Resource Usage</div>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <StatBar label="CPU" value={`${stats.cpu_percent.toFixed(1)}%`} pct={stats.cpu_percent} max={100} />
                  <StatBar
                    label="Memory"
                    value={`${stats.mem_used_mb} / ${stats.mem_limit_mb} MB`}
                    pct={stats.mem_used_mb}
                    max={stats.mem_limit_mb || 1}
                  />
                </div>
              </div>
            )}

            {details.env.length > 0 && (
              <div className="mt-2">
                <div className={labelClass}>Environment</div>
                <div className="flex flex-col gap-1 mt-1.5">
                  {details.env.map((e, i) => (
                    <code key={i} className="text-[11px] text-green font-mono bg-bg-deep px-2 py-0.5 rounded border border-border-light overflow-hidden text-ellipsis">
                      {e}
                    </code>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2 items-start">
      <span className={labelClass}>{label}</span>
      <span className="text-[12px] text-text-2 font-mono break-all">{value}</span>
    </div>
  );
}

function StatBar({ label, value, pct, max }: { label: string; value: string; pct: number; max: number }) {
  const percent = Math.min((pct / max) * 100, 100);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between">
        <span className={`${labelClass} normal-case`}>{label}</span>
        <span className="text-[11px] text-text-2 font-mono">{value}</span>
      </div>
      <div className="bg-surface-3 rounded h-1.5 overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${percent > 80 ? "bg-orange" : "bg-green"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

const labelClass = "text-[10px] font-mono uppercase tracking-wider text-text-3";
