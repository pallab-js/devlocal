import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ipc, type VolumeInfo } from "../lib/ipc";
import { Skeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { Button } from "../components/ui/Button";
import { ConfirmModal, Modal } from "../components/ui/Modal";

function useVolumes() {
  return useQuery({
    queryKey: ["volumes"],
    queryFn: () => ipc.listVolumes(),
  });
}

export function Volumes() {
  const qc = useQueryClient();
  const { data: volumes, isLoading, error, isFetching } = useVolumes();
  const [confirmPrune, setConfirmPrune] = useState(false);
  const [pruning, setPruning] = useState(false);
  const [selected, setSelected] = useState<VolumeInfo | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<Record<string, unknown> | null>(null);
  /** Track which volume name is currently loading its details */
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const { toast } = useToast();

  async function handlePrune() {
    setPruning(true);
    try {
      const freed = await ipc.pruneVolumes();
      toast(`Pruned unused volumes. Freed ${(freed / 1024 / 1024).toFixed(1)} MB.`, "success");
      qc.invalidateQueries({ queryKey: ["volumes"] });
    } catch (e) {
      toast(String(e), "error");
    } finally {
      setPruning(false);
      setConfirmPrune(false);
    }
  }

  async function handleInspect(v: VolumeInfo) {
    setSelected(v);
    setSelectedDetail(null);
    setLoadingId(v.name);
    try {
      const detail = await ipc.inspectVolume(v.name);
      setSelectedDetail(detail);
    } catch {
      setSelectedDetail(null);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-[18px] font-bold text-text m-0">Volumes</h1>
        <div className="flex gap-2">
          <Button
            onClick={() => qc.invalidateQueries({ queryKey: ["volumes"] })}
            disabled={isFetching}
            variant="secondary"
            size="sm"
            aria-label="Refresh volumes"
          >
            {isFetching ? "…" : "↻ Refresh"}
          </Button>
          <Button onClick={() => setConfirmPrune(true)} variant="danger" size="sm">
            Prune unused
          </Button>
        </div>
      </div>

      {/* Table */}
      <section className="bg-surface border border-border rounded-lg overflow-hidden">
        {isLoading && (
          <div className="p-4 flex flex-col gap-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} height={40} />)}
          </div>
        )}
        {error && (
          <p className="p-4 text-error text-[13px]">Docker unavailable.</p>
        )}
        {volumes?.length === 0 && (
          <p className="p-4 text-text-3 text-[13px]">No volumes found.</p>
        )}
        {volumes && volumes.length > 0 && (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-hi">
                {["Name", "Driver", "Scope", "Created", ""].map((h) => (
                  <th
                    key={h}
                    className="text-left px-3 py-2.5 text-[10px] font-mono uppercase tracking-[0.8px] text-text-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {volumes.map((v) => (
                <tr key={v.name} className="border-b border-border-light hover:bg-surface-hi/50 transition-colors">
                  <td className="px-3 py-2.5 text-violet font-mono text-[12px] max-w-[180px] truncate">{v.name}</td>
                  <td className="px-3 py-2.5 text-text-3 font-mono text-[12px]">{v.driver}</td>
                  <td className="px-3 py-2.5 text-text-3 font-mono text-[12px]">{v.scope}</td>
                  <td className="px-3 py-2.5 text-text-3 font-mono text-[12px]">
                    {v.created ? new Date(v.created).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <Button
                      onClick={() => handleInspect(v)}
                      loading={loadingId === v.name}
                      variant="ghost"
                      size="sm"
                      aria-label={`Inspect volume ${v.name}`}
                    >
                      Inspect
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Inspect Modal */}
      <Modal
        open={!!selected}
        onClose={() => { setSelected(null); setSelectedDetail(null); }}
        title={selected?.name ?? "Volume"}
        width="max-w-lg"
      >
        {selected && (
          <div className="flex flex-col gap-3">
            {[
              ["Driver", selected.driver],
              ["Scope", selected.scope],
              ["Mountpoint", selected.mountpoint],
              ["Created", selected.created || "—"],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[110px_1fr] gap-2 items-start">
                <span className="text-[10px] font-mono uppercase tracking-[0.8px] text-text-3 pt-0.5">{k}</span>
                <span className="text-[12px] font-mono text-text-2 break-all">{v}</span>
              </div>
            ))}

            {/* Extra inspect data */}
            {loadingId === selected.name && (
              <div className="flex items-center gap-2 text-[12px] text-text-3 font-mono mt-2">
                <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Loading details…
              </div>
            )}
            {selectedDetail &&
              Object.entries(selectedDetail)
                .filter(([k]) => !["Name", "Driver", "Mountpoint", "CreatedAt", "Scope"].includes(k))
                .map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[110px_1fr] gap-2 items-start">
                    <span className="text-[10px] font-mono uppercase tracking-[0.8px] text-text-3 pt-0.5">{k}</span>
                    <span className="text-[12px] font-mono text-text-2 break-all">
                      {typeof v === "object" && v !== null ? JSON.stringify(v, null, 1) : String(v)}
                    </span>
                  </div>
                ))}
          </div>
        )}
      </Modal>

      {/* Prune Confirm Modal */}
      <ConfirmModal
        open={confirmPrune}
        onClose={() => setConfirmPrune(false)}
        onConfirm={handlePrune}
        title="Prune unused volumes?"
        message="This will permanently delete all volumes not used by any container. This cannot be undone."
        confirmLabel="Prune"
        variant="danger"
        loading={pruning}
      />
    </div>
  );
}
