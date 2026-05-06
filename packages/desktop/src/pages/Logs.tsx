import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useContainers } from "../hooks/useQueries";
import { ipc } from "../lib/ipc";
import { Skeleton } from "../components/Skeleton";
import { useDebounce } from "../hooks/useDebounce";

type Level = "ALL" | "DEBUG" | "INFO" | "WARN" | "ERROR";

interface LogLine {
  id: number;
  ts: string;
  text: string;
  level: Level;
  containerId: string;
}

interface RawLogPayload {
  container_id: string;
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

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${query})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-500/40 text-yellow-200">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

export function Logs() {
  const { data: containers, isLoading: cLoading } = useContainers();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [filter, setFilter] = useState<Level>("ALL");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [tail, setTail] = useState(100);
  const [streaming, setStreaming] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const idRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const containerNames = useMemo(() => {
    const m: Record<string, string> = {};
    containers?.forEach((c) => (m[c.id] = c.name));
    return m;
  }, [containers]);

  const toggleContainer = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setLines([]);
  }, []);

  useEffect(() => {
    if (selectedIds.length === 0) {
      setStreaming(false);
      ipc.stopLogs().catch(() => {});
      return;
    }

    selectedIds.forEach((id) => {
      ipc.streamLogs(id, tail).catch(() => {});
    });

    const unlisten = listen<RawLogPayload>("log-line", (event) => {
      setStreaming(true);
      idRef.current += 1;
      const id = idRef.current;
      const { container_id, ts, text } = event.payload;
      setLines((prev) => [
        ...prev.slice(-4999),
        { id, ts, text, level: detectLevel(text), containerId: container_id },
      ]);
    });

    return () => {
      setStreaming(false);
      unlisten.then((fn) => fn());
      ipc.stopLogs().catch(() => {});
    };
  }, [selectedIds, tail]);

  const visible = useMemo(() => {
    return lines.filter((l) => {
      if (filter !== "ALL" && l.level !== filter) return false;
      if (debouncedSearch && !l.text.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
      return true;
    });
  }, [lines, filter, debouncedSearch]);

  const rowVirtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 22,
    overscan: 20,
  });

  // Auto-scroll logic
  useEffect(() => {
    if (autoScroll && visible.length > 0) {
      rowVirtualizer.scrollToIndex(visible.length - 1, { behavior: "smooth" });
    }
  }, [visible.length, autoScroll, rowVirtualizer]);

  // Detect manual scroll up → disable auto-scroll
  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  }

  async function copyToClipboard() {
    const text = visible
      .map((l) => `${l.ts ? formatTs(l.ts) + " " : ""}[${containerNames[l.containerId] || "unknown"}] ${l.text}`)
      .join("\n");
    await navigator.clipboard.writeText(text);
  }

  async function exportLogs() {
    if (visible.length === 0) return;

    const name =
      selectedIds.length === 1 ? containerNames[selectedIds[0]] : `${selectedIds.length}-containers`;

    const path = await save({
      filters: [{ name: "Logs", extensions: ["log", "txt"] }],
      defaultPath: `${name}-logs.log`,
    });

    if (path) {
      const text = visible
        .map((l) => `${l.ts ? l.ts + " " : ""}[${containerNames[l.containerId] || "unknown"}] ${l.text}`)
        .join("\n");
      await writeTextFile(path, text);
    }
  }

  const sel: React.CSSProperties = {
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    padding: "5px 8px",
    color: "var(--text)",
    fontSize: 12,
    fontFamily: "var(--font-mono)",
    outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", height: "100%" }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", margin: 0 }}>Logs</h1>

      {/* Row 1: container + tail + streaming indicator */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        {cLoading ? (
          <Skeleton width={200} height={32} />
        ) : (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {containers?.map((c) => {
              const active = selectedIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggleContainer(c.id)}
                  style={{
                    fontSize: 10,
                    padding: "4px 10px",
                    borderRadius: 4,
                    border: `1px solid ${active ? "var(--blue)" : "var(--border)"}`,
                    background: active ? "var(--blue-dim)" : "var(--surface-1)",
                    color: active ? "var(--blue)" : "var(--text-3)",
                    cursor: "pointer",
                    fontFamily: "var(--font-mono)",
                    transition: "all 0.1s",
                  }}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
          <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>Tail</span>
          <select value={tail} onChange={(e) => setTail(Number(e.target.value))} style={sel}>
            {TAIL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {selectedIds.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: streaming ? "var(--green)" : "var(--text-3)",
                boxShadow: streaming ? "0 0 6px var(--green)" : "none",
                animation: streaming ? "pulse 1.5s infinite" : "none",
              }}
            />
            <span
              style={{
                fontSize: 11,
                color: streaming ? "var(--green)" : "var(--text-3)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {streaming ? "live" : "connecting…"}
            </span>
          </div>
        )}

        {/* Stop / Clear / Copy / Export */}
        <div style={{ display: "flex", gap: 6 }}>
          {streaming && (
            <button
              onClick={() => {
                ipc.stopLogs();
                setStreaming(false);
              }}
              style={iconBtn("var(--orange)", "var(--orange-dim)")}
            >
              ■ Stop
            </button>
          )}
          <button
            onClick={() => setLines([])}
            disabled={lines.length === 0}
            style={iconBtn("var(--text-3)", "var(--surface-2)")}
          >
            Clear
          </button>
          <button
            onClick={copyToClipboard}
            disabled={visible.length === 0}
            style={iconBtn("var(--text-3)", "var(--surface-2)")}
          >
            Copy
          </button>
          <button
            onClick={exportLogs}
            disabled={visible.length === 0}
            style={iconBtn("var(--text-3)", "var(--surface-2)")}
          >
            Export
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
            <button
              key={l}
              onClick={() => setFilter(l)}
              style={{
                fontSize: 10,
                padding: "3px 9px",
                borderRadius: 9999,
                border: `1px solid ${filter === l ? LEVEL_COLOR[l] : "var(--border)"}`,
                background: filter === l ? "var(--surface-2)" : "transparent",
                color: filter === l ? LEVEL_COLOR[l] : "var(--text-3)",
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.8px",
              }}
            >
              {l}
            </button>
          ))}
        </div>

        <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
          {visible.length} lines
        </span>

        <button
          onClick={() => {
            setAutoScroll((v) => !v);
            if (!autoScroll && visible.length > 0) {
              rowVirtualizer.scrollToIndex(visible.length - 1, { behavior: "smooth" });
            }
          }}
          style={{
            fontSize: 10,
            padding: "3px 9px",
            borderRadius: 9999,
            border: `1px solid ${autoScroll ? "var(--green-border)" : "var(--border)"}`,
            background: autoScroll ? "var(--green-dim)" : "transparent",
            color: autoScroll ? "var(--green)" : "var(--text-3)",
            cursor: "pointer",
            fontFamily: "var(--font-mono)",
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
          flex: 1,
          background: "var(--bg-deep)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "0.75rem 1rem",
          overflow: "auto",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          lineHeight: 1.7,
          minHeight: 300,
          position: "relative",
        }}
      >
        {!selectedIds.length && <p style={{ color: "var(--text-3)" }}>Select containers to stream logs.</p>}
        {selectedIds.length > 0 && visible.length === 0 && lines.length > 0 && (
          <p style={{ color: "var(--text-3)" }}>No lines match the current filter.</p>
        )}

        {visible.length > 0 && (
          <div style={{ height: rowVirtualizer.getTotalSize(), width: "100%", position: "relative" }}>
            {rowVirtualizer.getVirtualItems().map((vRow) => {
              const line = visible[vRow.index];
              return (
                <div
                  key={line.id}
                  style={{
                    position: "absolute",
                    top: vRow.start,
                    left: 0,
                    width: "100%",
                    display: "flex",
                    gap: 10,
                    color: LEVEL_COLOR[line.level],
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                  }}
                >
                  <div style={{ display: "flex", gap: 8, flexShrink: 0, userSelect: "none" }}>
                    {line.ts && <span style={{ color: "var(--text-3)" }}>{formatTs(line.ts)}</span>}
                    <span
                      style={{
                        color: "var(--text-2)",
                        background: "var(--surface-2)",
                        padding: "0 4px",
                        borderRadius: 2,
                        fontSize: 10,
                      }}
                    >
                      {containerNames[line.containerId] || "???"}
                    </span>
                  </div>
                  <span>{highlightText(line.text, debouncedSearch)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}

function iconBtn(color: string, bg: string): React.CSSProperties {
  return {
    fontSize: 11,
    padding: "4px 10px",
    borderRadius: 4,
    border: `1px solid ${color === "var(--text-3)" ? "var(--border)" : color}`,
    background: bg,
    color,
    cursor: "pointer",
    fontFamily: "var(--font-mono)",
  };
}
