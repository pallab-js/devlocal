import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNetworkTopology } from "../hooks/useQueries";
import { ipc, type NetworkInfo } from "../lib/ipc";
import { Skeleton } from "../components/Skeleton";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";

function NetworkDetailModal({ net, onClose }: { net: NetworkInfo; onClose: () => void }) {
  return (
    <Modal open={true} onClose={onClose} title={net.name} width="max-w-lg">
      {/* Network metadata */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        {[
          ["ID", net.id.slice(0, 12)],
          ["Driver", net.driver],
          ["Scope", net.scope],
          ["Subnet", net.subnet || "—"],
          ["Gateway", net.gateway || "—"],
        ].map(([k, v]) => (
          <div key={k} className="bg-surface-hi border border-border-light rounded px-3 py-2">
            <div className="text-[10px] font-mono uppercase tracking-[0.8px] text-text-3 mb-1">{k}</div>
            <div className="text-[12px] font-mono text-text-2">{v}</div>
          </div>
        ))}
      </div>

      {/* Containers table */}
      <div className="text-[11px] font-mono uppercase tracking-[0.8px] text-text-3 mb-2">
        Containers ({net.containers.length})
      </div>
      {net.containers.length === 0 ? (
        <p className="text-text-3 text-[13px]">No containers attached.</p>
      ) : (
        <table className="w-full border-collapse text-[12px] font-mono">
          <thead>
            <tr className="border-b border-border">
              {["Name", "IPv4", "MAC"].map((h) => (
                <th
                  key={h}
                  className="text-left px-2 py-1.5 text-[10px] uppercase tracking-[0.8px] text-text-3"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {net.containers.map((c) => (
              <tr key={c.mac || c.name} className="border-b border-border-light">
                <td className="px-2 py-2 text-green">{c.name}</td>
                <td className="px-2 py-2 text-text-2">{c.ipv4 || "—"}</td>
                <td className="px-2 py-2 text-text-3">{c.mac || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

export function Network() {
  const qc = useQueryClient();
  const { data: networks, isLoading, error, isFetching } = useNetworkTopology();
  const [selected, setSelected] = useState<NetworkInfo | null>(null);

  async function handleInspect(id: string) {
    const detail = await ipc.inspectNetwork(id);
    setSelected(detail);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-[18px] font-bold text-text m-0">Network Topology</h1>
        <Button
          onClick={() => qc.invalidateQueries({ queryKey: ["network-topology"] })}
          disabled={isFetching}
          variant="secondary"
          size="sm"
          aria-label="Refresh network topology"
        >
          {isFetching ? "Refreshing…" : "↻ Refresh"}
        </Button>
      </div>

      <section className="bg-surface border border-border rounded-lg p-4">
        {isLoading && (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} height={72} />)}
          </div>
        )}
        {error && <p className="text-error text-[13px]">Docker unavailable.</p>}
        {networks?.length === 0 && <p className="text-text-3 text-[13px]">No networks found.</p>}

        {networks && networks.length > 0 && (
          <div className="flex flex-col gap-2">
            {networks.map((net) => (
              <div
                key={net.id}
                className="bg-surface-hi border border-border-light rounded-lg px-4 py-3 hover:border-border-hi transition-colors"
              >
                {/* Header row */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="text-[13px] font-semibold text-violet font-mono">{net.name}</span>
                  <span className="text-[10px] text-text-3 font-mono px-1.5 py-0.5 border border-border-hi rounded-full">
                    {net.driver}
                  </span>
                  <span className="text-[10px] text-text-3 font-mono px-1.5 py-0.5 border border-border-hi rounded-full">
                    {net.scope}
                  </span>
                  {net.subnet && (
                    <span className="text-[10px] text-orange font-mono">{net.subnet}</span>
                  )}
                  {net.gateway && (
                    <span className="text-[10px] text-text-3 font-mono">gw {net.gateway}</span>
                  )}
                  <Button
                    onClick={() => handleInspect(net.id)}
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    aria-label={`Inspect network ${net.name}`}
                  >
                    Inspect
                  </Button>
                </div>

                {/* Containers */}
                {net.containers.length === 0 ? (
                  <span className="text-[12px] text-text-3">No containers attached</span>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {net.containers.map((c) => (
                      <div
                        key={c.mac || c.name}
                        className="flex flex-col bg-surface-2 border border-border rounded px-2.5 py-1.5"
                      >
                        <span className="text-[11px] text-green font-mono">{c.name}</span>
                        {c.ipv4 && (
                          <span className="text-[10px] text-text-3 font-mono">{c.ipv4}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {selected && (
        <NetworkDetailModal net={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
