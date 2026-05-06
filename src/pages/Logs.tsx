import { useState, useEffect, useRef, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { useContainers } from "../hooks/useQueries";
import { ipc } from "../lib/ipc";
import { Skeleton } from "../components/Skeleton";

type Level = "ALL" | "DEBUG" | "INFO" | "WARN" | "ERROR";

interface LogLine {
  id: number;
  ts: string;
  text: string;
  level: Level;
}

interface RawLogPayload {
  ts: string;
  text: string;
}

function detectLevel(text: string): Level {
  const u = text.toUpperCase();
  if (u.includes("ERROR") || u.includes(" ERR ") || u.includes("[ERR]")) return "ERROR";
  if (u.includes("WARN") || u.includes("[WRN]")) return "WARN";
  if (u.includes("DEBUG") || u.includes("[DBG]")) return "DEBUG";
  return "INFO";
}

const LEVEL_COLOR: Record<Level, string> = {
  ALL: "var(--text-2)",
  DEBUG: "var(--text-3)",
  INFO: "var(--text-2)",
  WARN: "var(--orange)",
  ERROR: "var(--error)",
};

const TAIL_OPTIONS = [
  { label: "50", value: 50 },
  { label: "100", value: 100 },
  { label: "500", value: 500 },
  { label: "All", value: 0 },
];

function formatTs(ts: string): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return ts.slice(11, 19); // fallback: slice HH:MM:SS from ISO string
  }
}

export function Logs() {
  const { data: containers, isLoading: cLoading } = useContainers();
  const [selectedId, setSelectedId] = useState("");
  const [lines, setLines] = useState<LogLine[]>([]);
  const [filter, setFilter] = useState<Level>("ALL");
  const [search, setSearch] = useState("");
  const [tail, setTail] = useState(100);
  const [streaming, setStreaming] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const idRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const startStream = useCallback((containerId: string, tailSize: number) => {
    setLines([]);
    setStreaming(false);
    ipc.streamLogs(containerId, tailSize || undefined)
      .then(() => setStreaming(true))
      .catch(() => setStreaming(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    startStream(selectedId, tail);

    const unlisten = listen<RawLogPayload>("log-line", (event) => {
      setStreaming(true);
      idRef.current += 1;
      const id = idRef.current;
      const { ts, text } = event.payload;
      setLines((prev) => [
        ...prev.slice(-4999),
        { id, ts, text, level: detectLevel(text) },
      ]);
    });

    return () => {
      setStreaming(false);
      unlisten.then((fn) => fn());
      ipc.stopLogs().catch(() => {});
    };
  }, [selectedId, tail, startStream]);

  // Auto-scroll
  useEffect(() => {
    if (!autoScroll) return;
    if (typeof bottomRef.current?.scrollIntoView === "function") {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [lines, autoScroll]);

  // Detect manual scroll up → disable auto-scroll
  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  }

  const visible = lines.filter((l) => {
    if (filter !== "ALL" && l.level !== filter) return false;
    if (search && !l.text.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function copyToClipboard() {
    const text = visible.map((l) => `${l.ts ? formatTs(l.ts) + " " : ""}${l.text}`).join("\n");
    await navigator.clipboard.writeText(text);
  }

  const sel: React.CSSProperties = {
    background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 4,
    padding: "5px 8px", color: "var(--text)", fontSize: 12,
    fontFamily: "var(--font-mono)", outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", height: "100%" }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", margin: 0 }}>Logs</h1>

      {/* Row 1: container + tail + streaming indicator */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {cLoading ? <Skeleton width={200} height={32} /> : (
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} style={{ ...sel, minWidth: 200 }}>
            <option value="">Select container…</option>
            {containers?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>Tail</span>
          <select value={tail} onChange={(e) => setTail(Number(e.target.value))} style={sel}>
            {TAIL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {selectedId && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 7, height: 7, borderRadius: "50%",
              background: streaming ? "var(--green)" : "var(--text-3)",
              boxShadow: streaming ? "0 0 6px var(--green)" : "none",
              animation: streaming ? "pulse 1.5s infinite" : "none",
            }} />
            <span style={{ fontSize: 11, color: streaming ? "var(--green)" : "var(--text-3)", fontFamily: "var(--font-mono)" }}>
              {streaming ? "live" : "connecting…"}
            </span>
          </div>
        )}

        {/* Stop / Clear / Copy */}
        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          {streaming && (
            <button onClick={() => { ipc.stopLogs(); setStreaming(false); }} style={iconBtn("var(--orange)", "var(--orange-dim)")}>
              ■ Stop
            </button>
          )}
          <button onClick={() => setLines([])} disabled={lines.length === 0} style={iconBtn("var(--text-3)", "var(--surface-2)")}>
            Clear
          </button>
          <button onClick={copyToClipboard} disabled={visible.length === 0} style={iconBtn("var(--text-3)", "var(--surface-2)")}>
            Copy
          </button>
        </div>
      </div>

      {/* Row 2: search + level filters + line count + auto-scroll toggle */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search logs…"
          style={{ ...sel, minWidth: 180, flex: 1 }}
        />

        <div style={{ display: "flex", gap: 5 }}>
          {(["ALL", "DEBUG", "INFO", "WARN", "ERROR"] as Level[]).map((l) => (
            <button key={l} onClick={() => setFilter(l)} style={{
              fontSize: 10, padding: "3px 9px", borderRadius: 9999,
              border: `1px solid ${filter === l ? LEVEL_COLOR[l] : "var(--border)"}`,
              background: filter === l ? "var(--surface-2)" : "transparent",
              color: filter === l ? LEVEL_COLOR[l] : "var(--text-3)",
              cursor: "pointer", fontFamily: "var(--font-mono)", letterSpacing: "0.8px",
            }}>{l}</button>
          ))}
        </div>

        <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
          {visible.length} lines
        </span>

        <button
          onClick={() => { setAutoScroll((v) => !v); if (!autoScroll) bottomRef.current?.scrollIntoView?.({ behavior: "smooth" }); }}
          style={{
            fontSize: 10, padding: "3px 9px", borderRadius: 9999,
            border: `1px solid ${autoScroll ? "var(--green-border)" : "var(--border)"}`,
            background: autoScroll ? "var(--green-dim)" : "transparent",
            color: autoScroll ? "var(--green)" : "var(--text-3)",
            cursor: "pointer", fontFamily: "var(--font-mono)",
          }}
        >
          ↓ Auto-scroll
        </button>
      </div>

      {/* Log output */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1, background: "var(--bg-deep)", border: "1px solid var(--border)",
          borderRadius: 8, padding: "0.75rem 1rem", overflow: "auto",
          fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.7, minHeight: 300,
        }}
      >
        {!selectedId && <p style={{ color: "var(--text-3)" }}>Select a container to stream logs.</p>}
        {selectedId && visible.length === 0 && lines.length > 0 && (
          <p style={{ color: "var(--text-3)" }}>No lines match the current filter.</p>
        )}
        {visible.map((line) => (
          <div key={line.id} style={{ display: "flex", gap: 10, color: LEVEL_COLOR[line.level], whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {line.ts && (
              <span style={{ color: "var(--text-3)", flexShrink: 0, userSelect: "none" }}>{formatTs(line.ts)}</span>
            )}
            <span>{line.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}

function iconBtn(color: string, bg: string): React.CSSProperties {
  return {
    fontSize: 11, padding: "4px 10px", borderRadius: 4,
    border: `1px solid ${color === "var(--text-3)" ? "var(--border)" : color}`,
    background: bg, color, cursor: "pointer", fontFamily: "var(--font-mono)",
  };
}
