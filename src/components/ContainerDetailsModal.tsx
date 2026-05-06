import { useEffect, useState } from "react";
import { ipc, type ContainerDetails } from "../lib/ipc";

interface Props {
  containerId: string;
  onClose: () => void;
}

export function ContainerDetailsModal({ containerId, onClose }: Props) {
  const [details, setDetails] = useState<ContainerDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ipc.inspectContainer(containerId)
      .then(setDetails)
      .catch((e) => setError(String(e)));
  }, [containerId]);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "1.5rem", width: 520, maxHeight: "80vh", overflow: "auto" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <span style={{ fontWeight: 700, color: "var(--text)", fontSize: 15 }}>
            {details?.name ?? "Container Details"}
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        {error && <p style={{ color: "var(--error)", fontSize: 13 }}>{error}</p>}
        {!details && !error && <p style={{ color: "var(--text-3)", fontSize: 13 }}>Loading…</p>}

        {details && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Row label="Image" value={details.image} />
            <Row label="State" value={details.state} />
            <Row label="Ports" value={details.ports.join(", ") || "—"} />
            <Row label="Mounts" value={details.mounts.join(", ") || "—"} />
            <Row label="Command" value={details.cmd.join(" ") || "—"} />
            {details.env.length > 0 && (
              <div>
                <div style={labelStyle}>Environment</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
                  {details.env.map((e, i) => (
                    <code key={i} style={{ fontSize: 11, color: "var(--green)", fontFamily: "var(--font-mono)", background: "var(--bg-deep)", padding: "2px 6px", borderRadius: 3 }}>
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
    <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 8, alignItems: "start" }}>
      <span style={labelStyle}>{label}</span>
      <span style={{ fontSize: 12, color: "var(--text-2)", fontFamily: "var(--font-mono)", wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase",
  letterSpacing: "0.8px", color: "var(--text-3)",
};
