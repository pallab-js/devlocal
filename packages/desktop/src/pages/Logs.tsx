import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useContainers } from "../hooks/useQueries";
import { ipc } from "../lib/ipc";
import { Skeleton } from "../components/Skeleton";
import { useDebounce } from "../hooks/useDebounce";
import { Button } from "../components/ui/Button";

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

const LEVEL_ACTIVE: Record<Level, string> = {
  ALL: "text-text-2 border-border-hi bg-surface-2",
  DEBUG: "text-text-3 border-border-hi bg-surface-2",
  INFO: "text-blue border-blue/40 bg-blue/10",
  WARN: "text-orange border-orange/40 bg-orange/10",
  ERROR: "text-error border-error/40 bg-error/10",
};

const TAIL_OPTIONS = [
  { label: "50",  value: 50 },
  { label: "100", value: 100 },
  { label: "500", value: 500 },
  { label: "All", value: 0 },
];

function formatTs(ts: string): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return ts.slice(11, 19);
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const escaped = escapeRegex(query);
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (<>{parts.map((part, i) => part.toLowerCase() === query.toLowerCase() ? (
    <mark key={i} className="bg-yellow-500/40 text-yellow-200 rounded-[2px]">{part}</mark>
  ) : part)}</>);
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
    let active = true;
    let unlistenFn: (() => void) | null = null;

    listen<RawLogPayload>("log-line", (event) => {
      if (active) {
        setStreaming(true);
        idRef.current += 1;
        const id = idRef.current;
        const { container_id, ts, text } = event.payload;
        setLines((prev) => [
          ...prev.slice(-4999),
          { id, ts, text, level: detectLevel(text), containerId: container_id },
        ]);
      }
    }).then((fn) => {
      if (!active) {
        fn();
      } else {
        unlistenFn = fn;
      }
    });

    return () => {
      active = false;
      setStreaming(false);
      if (unlistenFn) {
        try {
          unlistenFn();
        } catch (e) {
          console.error("Error unlistening log-line:", e);
        }
      }
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

  useEffect(() => {
    if (autoScroll && visible.length > 0) {
      rowVirtualizer.scrollToIndex(visible.length - 1, { behavior: "smooth" });
    }
  }, [visible.length, autoScroll, rowVirtualizer]);

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
    const name = selectedIds.length === 1 ? containerNames[selectedIds[0]] : `${selectedIds.length}-containers`;
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

  return (
    <div className="flex flex-col gap-3 h-full">
      <h1 className="text-[18px] font-bold text-text m-0">Logs</h1>

      {/* Row 1: container selector + tail + streaming indicator */}
      <div className="flex gap-3 items-center flex-wrap">
        {cLoading ? (
          <Skeleton width={200} height={32} />
        ) : (
          <div className="flex gap-1.5 flex-wrap">
            {containers?.map((c) => {
              const active = selectedIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggleContainer(c.id)}
                  aria-pressed={active}
                  className={`text-[10px] px-2.5 py-1 rounded border font-mono transition-all cursor-pointer ${
                    active
                      ? "border-blue/50 bg-blue-dim text-blue"
                      : "border-border bg-surface-2 text-text-3 hover:text-text-2 hover:bg-surface-3"
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[11px] text-text-3 font-mono">Tail</span>
          <select
            value={tail}
            onChange={(e) => setTail(Number(e.target.value))}
            aria-label="Log tail count"
            className="bg-surface-2 border border-border rounded px-2 py-1 text-[12px] text-text font-mono outline-none focus:border-green transition-colors"
          >
            {TAIL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full transition-colors ${
                streaming ? "bg-green animate-pulse-dot shadow-[0_0_6px_var(--green)]" : "bg-text-3"
              }`}
              role="status"
              aria-label={streaming ? "Log stream live" : "Connecting to log stream"}
            />
            <span className={`text-[11px] font-mono ${streaming ? "text-green" : "text-text-3"}`}>
              {streaming ? "live" : "connecting…"}
            </span>
          </div>
        )}

        <div className="flex gap-1.5">
          {streaming && (
            <Button
              onClick={() => { ipc.stopLogs().catch(() => {}); setStreaming(false); }}
              variant="warning"
              size="sm"
            >
              ■ Stop
            </Button>
          )}
          <Button onClick={() => setLines([])} disabled={lines.length === 0} variant="ghost" size="sm">
            Clear
          </Button>
          <Button onClick={copyToClipboard} disabled={visible.length === 0} variant="ghost" size="sm">
            Copy
          </Button>
          <Button onClick={exportLogs} disabled={visible.length === 0} variant="ghost" size="sm">
            Export
          </Button>
        </div>
      </div>

      {/* Row 2: search + level filters + count + auto-scroll */}
      <div className="flex gap-2 items-center flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search logs…"
          aria-label="Search log output"
          className="bg-surface-2 border border-border rounded px-2.5 py-1 text-[12px] text-text font-mono outline-none focus:border-green focus:ring-1 focus:ring-green/30 transition-colors placeholder:text-text-3 flex-1 min-w-[160px]"
        />

        <div className="flex gap-1">
          {(["ALL", "DEBUG", "INFO", "WARN", "ERROR"] as Level[]).map((l) => (
            <button
              key={l}
              onClick={() => setFilter(l)}
              aria-pressed={filter === l}
              className={`text-[10px] px-2.5 py-1 rounded-full border font-mono cursor-pointer transition-colors ${
                filter === l
                  ? LEVEL_ACTIVE[l]
                  : "border-border text-text-3 hover:text-text-2 hover:bg-surface-2"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        <span className="text-[11px] text-text-3 font-mono whitespace-nowrap">
          {visible.length} lines
        </span>

        <button
          onClick={() => {
            setAutoScroll((v) => !v);
            if (!autoScroll && visible.length > 0) {
              rowVirtualizer.scrollToIndex(visible.length - 1, { behavior: "smooth" });
            }
          }}
          aria-pressed={autoScroll}
          className={`text-[10px] px-2.5 py-1 rounded-full border font-mono cursor-pointer transition-colors ${
            autoScroll
              ? "border-green-border bg-green-dim text-green"
              : "border-border text-text-3 hover:text-text-2"
          }`}
        >
          ↓ Auto-scroll
        </button>
      </div>

      {/* Log output */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 bg-bg-deep border border-border rounded-lg p-3 overflow-auto font-mono text-[12px] leading-relaxed min-h-[300px] relative"
        role="log"
        aria-live="polite"
        aria-label="Log output"
      >
        {!selectedIds.length && (
          <p className="text-text-3">Select containers above to stream logs.</p>
        )}
        {selectedIds.length > 0 && visible.length === 0 && lines.length > 0 && (
          <p className="text-text-3">No lines match the current filter.</p>
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
                  <div className="flex gap-2 shrink-0 select-none">
                    {line.ts && <span className="text-text-3">{formatTs(line.ts)}</span>}
                    <span className="text-text-2 bg-surface-2 px-1 rounded text-[10px]">
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
    </div>
  );
}
