import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNetworkTopology } from "../hooks/useQueries";
import { ipc, type NetworkInfo } from "../lib/ipc";
import { Skeleton } from "../components/Skeleton";

function NetworkDetailModal({ net, onClose }: { net: NetworkInfo; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "1.5rem", width: 540, maxHeight: "80vh", overflow: "auto" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <span style={{ fontWeight: 700, color: "var(--violet)", fontSize: 15, fontFamily: "var(--font-mono)" }}>{net.name}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 18 }}>×</button>
        </div>

        {/* Network metadata */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: "1rem" }}>
          {[
            ["ID", net.id.slice(0, 12)],
            ["Driver", net.driver],
            ["Scope", net.scope],
            ["Subnet", net.subnet || "—"],
            ["Gateway", net.gateway || "—"],
          ].map(([k, v]) => (
            <div key={k} style={{ background: "var(--surface-hi)", border: "1px solid var(--border-light)", borderRadius: 4, padding: "6px 10px" }}>
              <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-3)", marginBottom: 2 }}>{k}</div>
              <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-2)" }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Containers table */}
        <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-3)", marginBottom: 8 }}>
          Containers ({net.containers.length})
        </div>
        {net.containers.length === 0 ? (
          <p style={{ color: "var(--text-3)", fontSize: 13 }}>No containers attached.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "var(--font-mono)" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Name", "IPv4", "MAC"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "5px 8px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-3)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {net.containers.map((c) => (
                <tr key={c.mac || c.name} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "7px 8px", color: "var(--green)" }}>{c.name}</td>
                  <td style={{ padding: "7px 8px", color: "var(--text-2)" }}>{c.ipv4 || "—"}</td>
                  <td style={{ padding: "7px 8px", color: "var(--text-3)" }}>{c.mac || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
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
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", margin: 0 }}>Network Topology</h1>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ["network-topology"] })}
          disabled={isFetching}
          style={{
            fontSize: 11, padding: "5px 14px", borderRadius: 4,
            border: "1px solid var(--border)", background: "var(--surface)",
            color: isFetching ? "var(--text-3)" : "var(--text-2)",
            cursor: isFetching ? "not-allowed" : "pointer",
            fontFamily: "var(--font-mono)",
          }}
        >
          {isFetching ? "Refreshing…" : "↻ Refresh"}
        </button>
      </div>

      <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "1rem 1.25rem" }}>
        {isLoading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[0, 1, 2].map(i => <Skeleton key={i} height={72} />)}
          </div>
        )}
        {error && <p style={{ color: "var(--error)", fontSize: 13 }}>Docker unavailable.</p>}
        {networks?.length === 0 && <p style={{ color: "var(--text-3)", fontSize: 13 }}>No networks found.</p>}
        {networks && networks.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {networks.map((net) => (
              <div key={net.id} style={{ background: "var(--surface-hi)", border: "1px solid var(--border-light)", borderRadius: 6, padding: "10px 14px" }}>
                {/* Header row */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--violet)", fontFamily: "var(--font-mono)" }}>{net.name}</span>
                  <span style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "var(--font-mono)", padding: "1px 6px", border: "1px solid var(--border-hi)", borderRadius: 9999 }}>{net.driver}</span>
                  <span style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "var(--font-mono)", padding: "1px 6px", border: "1px solid var(--border-hi)", borderRadius: 9999 }}>{net.scope}</span>
                  {net.subnet && (
                    <span style={{ fontSize: 10, color: "var(--orange)", fontFamily: "var(--font-mono)" }}>{net.subnet}</span>
                  )}
                  {net.gateway && (
                    <span style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>gw {net.gateway}</span>
                  )}
                  <button
                    onClick={() => handleInspect(net.id)}
                    style={{ marginLeft: "auto", fontSize: 10, padding: "2px 8px", borderRadius: 4, border: "1px solid var(--border-hi)", background: "transparent", color: "var(--text-3)", cursor: "pointer", fontFamily: "var(--font-mono)" }}
                  >
                    Inspect
                  </button>
                </div>

                {/* Containers */}
                {net.containers.length === 0 ? (
                  <span style={{ fontSize: 12, color: "var(--text-3)" }}>No containers attached</span>
                ) : (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {net.containers.map((c) => (
                      <div key={c.mac || c.name} style={{ display: "flex", flexDirection: "column", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 4, padding: "4px 10px" }}>
                        <span style={{ fontSize: 11, color: "var(--green)", fontFamily: "var(--font-mono)" }}>{c.name}</span>
                        {c.ipv4 && <span style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>{c.ipv4}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {selected && <NetworkDetailModal net={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
