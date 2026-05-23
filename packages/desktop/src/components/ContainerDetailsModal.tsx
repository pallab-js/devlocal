import { useEffect, useState } from "react";
import { ipc, type ContainerDetails, type ContainerStats } from "../lib/ipc";
import { useToast } from "./Toast";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { ProgressBar } from "./ui/index";

interface Props {
  containerId: string;
  onClose: () => void;
}

const SENSITIVE_RE = /secret|password|token|key|pwd|pass|auth|credential/i;

export function ContainerDetailsModal({ containerId, onClose }: Props) {
  const [details, setDetails] = useState<ContainerDetails | null>(null);
  const [stats, setStats] = useState<ContainerStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [masked, setMasked] = useState<Set<string>>(new Set());

  function toggleMask(key: string) {
    setMasked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function isMasked(key: string) {
    return !masked.has(key) && SENSITIVE_RE.test(key);
  }

  useEffect(() => {
    ipc.inspectContainer(containerId)
      .then(setDetails)
      .catch((e) => setError(String(e)));
    ipc.getContainerStats(containerId)
      .then(setStats)
      .catch(() => {}); // stats may fail for stopped containers
  }, [containerId]);

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={details?.name ?? "Container Details"}
      width="max-w-[540px]"
    >
      {error && (
        <p className="text-error text-[13px] bg-error/10 px-3 py-2 rounded border border-error/20 mb-3">
          {error}
        </p>
      )}
      {!details && !error && (
        <div className="flex items-center gap-2 text-text-3 text-[13px] font-mono">
          <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
          Loading…
        </div>
      )}

      {details && (
        <div className="flex flex-col gap-3">
          <Row label="Image"   value={details.image} />
          <Row label="State"   value={details.state} />
          <Row label="Ports"   value={details.ports.join(", ") || "—"} />
          <Row label="Mounts"  value={details.mounts.join(", ") || "—"} />
          <Row label="Command" value={details.cmd.join(" ") || "—"} />

          {/* Per-container resource stats */}
          {stats && (
            <div className="mt-1 pt-3 border-t border-border">
              <div className={labelClass}>Resource Usage</div>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <StatBar
                  label="CPU"
                  value={`${stats.cpu_percent.toFixed(1)}%`}
                  pct={stats.cpu_percent}
                  max={100}
                />
                <StatBar
                  label="Memory"
                  value={`${stats.mem_used_mb} / ${stats.mem_limit_mb} MB`}
                  pct={Number(stats.mem_used_mb)}
                  max={Number(stats.mem_limit_mb) || 1}
                />
              </div>
            </div>
          )}

          <LimitsEditor
            containerId={containerId}
            initialCpu={null}
            initialMem={stats ? Number(stats.mem_limit_mb) : undefined}
          />

          {/* Environment variables */}
          {details.env.length > 0 && (
            <div className="mt-1 pt-3 border-t border-border">
              <div className={labelClass}>Environment</div>
              <div className="flex flex-col gap-1 mt-2">
                {details.env.map((raw, i) => {
                  const eqIdx = raw.indexOf("=");
                  const key = eqIdx > 0 ? raw.slice(0, eqIdx) : "";
                  const value = eqIdx > 0 ? raw.slice(eqIdx + 1) : raw;
                  const hidden = isMasked(key);
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-[11px] text-green font-mono bg-bg-deep px-2 py-1 rounded border border-border-light"
                    >
                      <code className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                        {key}={hidden ? "••••••••" : value}
                      </code>
                      {key && SENSITIVE_RE.test(key) && (
                        <button
                          onClick={() => toggleMask(key)}
                          aria-label={hidden ? `Show value for ${key}` : `Hide value for ${key}`}
                          className="text-text-3 hover:text-text-2 cursor-pointer border-none bg-transparent p-0 text-[10px] font-mono transition-colors shrink-0"
                        >
                          {hidden ? "show" : "hide"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
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
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between">
        <span className={labelClass}>{label}</span>
        <span className="text-[11px] text-text-2 font-mono">{value}</span>
      </div>
      <ProgressBar value={pct} max={max} />
    </div>
  );
}

const labelClass = "text-[10px] font-mono uppercase tracking-wider text-text-3";

function LimitsEditor({ containerId, initialCpu, initialMem }: {
  containerId: string;
  initialCpu: number | null;
  initialMem?: number;
}) {
  const [cpu, setCpu] = useState(initialCpu?.toString() ?? "");
  const [mem, setMem] = useState(initialMem?.toString() ?? "");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const cpuShares = cpu ? parseInt(cpu) : undefined;
      const memoryBytes = mem ? parseInt(mem) * 1024 * 1024 : undefined;
      await ipc.updateContainerLimits(containerId, cpuShares, memoryBytes);
      toast("Resource limits updated successfully", "success");
    } catch (e) {
      toast(`Error updating limits: ${e}`, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-1 pt-3 border-t border-border">
      <div className={`${labelClass} mb-2`}>Edit Resource Limits</div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="limits-cpu" className="text-[11px] text-text-2">CPU Shares</label>
          <input
            id="limits-cpu"
            type="number"
            value={cpu}
            onChange={(e) => setCpu(e.target.value)}
            placeholder="e.g. 1024"
            className="bg-bg-deep border border-border rounded px-2 py-1 text-[12px] text-text font-mono focus:outline-none focus:border-blue focus:ring-1 focus:ring-blue/30 transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="limits-mem" className="text-[11px] text-text-2">Memory (MB)</label>
          <input
            id="limits-mem"
            type="number"
            value={mem}
            onChange={(e) => setMem(e.target.value)}
            placeholder="e.g. 512"
            className="bg-bg-deep border border-border rounded px-2 py-1 text-[12px] text-text font-mono focus:outline-none focus:border-blue focus:ring-1 focus:ring-blue/30 transition-colors"
          />
        </div>
      </div>
      <Button
        onClick={handleUpdate}
        loading={loading}
        variant="secondary"
        size="sm"
        className="mt-3 w-full justify-center border-blue/30 text-blue bg-blue/10 hover:bg-blue/20"
      >
        Apply Resource Limits
      </Button>
    </div>
  );
}
