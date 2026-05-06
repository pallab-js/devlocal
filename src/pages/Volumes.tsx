import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ipc, type VolumeInfo } from "../lib/ipc";
import { Skeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", margin: 0 }}>Volumes</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ["volumes"] })}
            disabled={isFetching}
            style={btnStyle("var(--text-2)", "var(--surface)")}
          >
            {isFetching ? "…" : "↻ Refresh"}
          </button>
          <button
            onClick={() => setConfirmPrune(true)}
            style={btnStyle("var(--error)", "var(--error-dim)")}
          >
            Prune unused
          </button>
        </div>
      </div>

      <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
        {isLoading && (
          <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: 10 }}>
            {[0, 1, 2].map((i) => <Skeleton key={i} height={40} />)}
          </div>
        )}
        {error && <p style={{ padding: "1rem", color: "var(--error)", fontSize: 13 }}>Docker unavailable.</p>}
        {volumes?.length === 0 && <p style={{ padding: "1rem", color: "var(--text-3)", fontSize: 13 }}>No volumes found.</p>}
        {volumes && volumes.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Name", "Driver", "Scope", "Created", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-3)", background: "var(--surface-hi)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {volumes.map((v) => (
                <tr key={v.name} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "10px 12px", color: "var(--violet)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{v.name}</td>
                  <td style={{ padding: "10px 12px", color: "var(--text-3)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{v.driver}</td>
                  <td style={{ padding: "10px 12px", color: "var(--text-3)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{v.scope}</td>
                  <td style={{ padding: "10px 12px", color: "var(--text-3)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{v.created ? new Date(v.created).toLocaleDateString() : "—"}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <button onClick={() => setSelected(v)} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, border: "1px solid var(--border-hi)", background: "transparent", color: "var(--text-3)", cursor: "pointer", fontFamily: "var(--font-mono)" }}>
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Inspect modal */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "1.5rem", width: 480 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <span style={{ fontWeight: 700, color: "var(--violet)", fontSize: 15, fontFamily: "var(--font-mono)" }}>{selected.name}</span>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 18 }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                ["Driver", selected.driver],
                ["Scope", selected.scope],
                ["Mountpoint", selected.mountpoint],
                ["Created", selected.created || "—"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 8 }}>
                  <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-3)" }}>{k}</span>
                  <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-2)", wordBreak: "break-all" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Prune confirm */}
      {confirmPrune && (
        <div onClick={() => setConfirmPrune(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "1.5rem", width: 360 }}>
            <p style={{ color: "var(--text)", fontSize: 14, fontWeight: 600, margin: "0 0 8px" }}>Prune unused volumes?</p>
            <p style={{ color: "var(--text-3)", fontSize: 13, margin: "0 0 1.25rem" }}>
              This will permanently delete all volumes not used by any container.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmPrune(false)} style={btnStyle("var(--text-2)", "var(--surface-2)")}>Cancel</button>
              <button onClick={handlePrune} disabled={pruning} style={btnStyle("var(--error)", "var(--error-dim)")}>
                {pruning ? "Pruning…" : "Prune"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function btnStyle(color: string, bg: string): React.CSSProperties {
  return {
    fontSize: 11, padding: "5px 14px", borderRadius: 4,
    border: `1px solid ${color === "var(--text-2)" ? "var(--border)" : color}`,
    background: bg, color, cursor: "pointer", fontFamily: "var(--font-mono)",
  };
}
