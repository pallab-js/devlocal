import { useState, useEffect, useMemo } from "react";
import { ipc } from "../lib/ipc";
import type { DbSchema, DbQueryResult } from "../lib/ipc";
import { Button } from "../components/ui/Button";
import { useToast } from "../components/Toast";

/* ── SVG Icons ───────────────────────────────────────────────────────────── */

const DatabaseIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5V19A9 3 0 0 0 21 19V5" />
    <path d="M3 12A9 3 0 0 0 21 12" />
  </svg>
);

const PlayIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="6 3 20 12 6 21 6 3" />
  </svg>
);

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-text-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const KeyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5 text-orange" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 1.5 1.5M15.5 7.5 14 6" />
  </svg>
);

const TableIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-violet" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M3 9h18" />
    <path d="M3 15h18" />
    <path d="M9 3v18" />
    <path d="M15 3v18" />
  </svg>
);

const AlertCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-error" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const ChevronRightIcon = ({ className = "w-3 h-3" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const SparklesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
  </svg>
);

const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/* ── Component ───────────────────────────────────────────────────────────── */

export function Database() {
  const { toast } = useToast();
  
  // Connection states
  const [dbPath, setDbPath] = useState("");
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [schema, setSchema] = useState<DbSchema | null>(null);
  const [internalDbPath, setInternalDbPath] = useState<string | null>(null);

  // Schema list/sidebar search
  const [tableSearch, setTableSearch] = useState("");
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});

  // Query states
  const [sql, setSql] = useState("SELECT * FROM env_vars LIMIT 20;");
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<DbQueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  
  // Local results filter
  const [gridFilter, setGridFilter] = useState("");
  
  // Copy feedback states
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isCopiedAll, setIsCopiedAll] = useState(false);

  // Auto-discover the application's internal database path on mount
  useEffect(() => {
    ipc.getAppInfo()
      .then((info) => {
        if (info.db_path) {
          setInternalDbPath(info.db_path);
          // Set it as default path in input if empty
          setDbPath((prev) => (prev ? prev : info.db_path));
        }
      })
      .catch((err) => {
        console.error("Failed to discover internal DB:", err);
      });
  }, []);

  // Handle connection
  async function handleConnect(targetPath?: string) {
    const path = targetPath || dbPath;
    if (!path.trim()) {
      toast("Please specify a database path.", "error");
      return;
    }

    setConnecting(true);
    setQueryError(null);
    try {
      const res = await ipc.dbConnect(path);
      setSchema(res);
      setConnected(true);
      setDbPath(path);
      toast(`Successfully connected to ${path.split("/").pop()} in read-only mode!`, "success");
      
      // Auto-load first table if available
      if (res.tables && res.tables.length > 0) {
        const firstTable = res.tables[0].name;
        // Expand the first table in schema panel
        setExpandedTables((prev) => ({ ...prev, [firstTable]: true }));
        const autoSql = `SELECT * FROM ${firstTable} LIMIT 100;`;
        setSql(autoSql);
        runQuery(path, autoSql);
      } else {
        setSql("SELECT sqlite_version();");
        setResult(null);
      }
    } catch (err) {
      setSchema(null);
      setConnected(false);
      setResult(null);
      setQueryError(String(err));
      toast(`Connection failed: ${err}`, "error");
    } finally {
      setConnecting(false);
    }
  }

  // Handle Query Run
  async function handleRunQuery() {
    if (!connected) {
      toast("Not connected to a database.", "error");
      return;
    }
    await runQuery(dbPath, sql);
  }

  async function runQuery(path: string, queryText: string) {
    if (!queryText.trim()) {
      toast("Query is empty.", "error");
      return;
    }
    setExecuting(true);
    setQueryError(null);
    try {
      const res = await ipc.dbExecuteQuery(path, queryText);
      setResult(res);
    } catch (err) {
      setResult(null);
      setQueryError(String(err));
    } finally {
      setExecuting(false);
    }
  }

  // Quick preset loader
  function applyPreset(query: string) {
    setSql(query);
    if (connected) {
      runQuery(dbPath, query);
    }
  }

  // Auto-execute SELECT * when clicking table in sidebar
  function handleTableClick(tableName: string) {
    const query = `SELECT * FROM ${tableName} LIMIT 100;`;
    setSql(query);
    if (connected) {
      runQuery(dbPath, query);
    }
  }

  // Toggle table expand
  function toggleTable(tableName: string, e: React.MouseEvent) {
    e.stopPropagation(); // Avoid triggering query
    setExpandedTables((prev) => ({
      ...prev,
      [tableName]: !prev[tableName],
    }));
  }

  // Filtered Tables
  const filteredTables = useMemo(() => {
    if (!schema?.tables) return [];
    return schema.tables.filter((t) =>
      t.name.toLowerCase().includes(tableSearch.toLowerCase())
    );
  }, [schema, tableSearch]);

  // Filtered query rows locally
  const filteredRows = useMemo(() => {
    if (!result?.rows) return [];
    if (!gridFilter.trim()) return result.rows;
    const term = gridFilter.toLowerCase();
    return result.rows.filter((row: any) => {
      return Object.values(row).some((val) =>
        String(val).toLowerCase().includes(term)
      );
    });
  }, [result, gridFilter]);

  // Copy cell value to clipboard
  function copyToClipboard(text: string, index: number) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
    toast("Cell copied to clipboard", "success");
  }

  // Copy entire output as JSON
  function copyAllAsJson() {
    if (!result?.rows) return;
    navigator.clipboard.writeText(JSON.stringify(result.rows, null, 2));
    setIsCopiedAll(true);
    setTimeout(() => setIsCopiedAll(false), 2000);
    toast("Copied entire result set as JSON!", "success");
  }

  // Keyboard listener for Command+Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleRunQuery();
    }
  };

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-100px)] animate-[fade-in_0.2s_ease-out]">
      {/* DB Connection TopBar Card */}
      <div className="bg-surface border border-border rounded-lg p-3 shrink-0 flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-1">
          <DatabaseIcon className="w-5 h-5 text-green shrink-0" />
          <div className="flex-1 min-w-[200px] max-w-[500px]">
            <input
              type="text"
              value={dbPath}
              onChange={(e) => setDbPath(e.target.value)}
              placeholder="SQLite database file path (e.g. /path/to/database.db)"
              className="w-full bg-surface-2 border border-border rounded px-3 py-1.5 text-[12px] text-text font-mono outline-none focus:border-green focus:ring-1 focus:ring-green/30 transition-colors placeholder:text-text-3"
            />
          </div>
          <Button
            onClick={() => handleConnect()}
            loading={connecting}
            variant="primary"
            size="sm"
            className="shrink-0"
          >
            {connected ? "Reconnect" : "Connect"}
          </Button>
        </div>

        {internalDbPath && (
          <Button
            onClick={() => handleConnect(internalDbPath)}
            disabled={connecting}
            variant="secondary"
            size="sm"
            className="shrink-0 flex items-center gap-1.5 border-green-border/40 text-green bg-green/5 hover:bg-green/10"
          >
            <SparklesIcon />
            Inspect App internal DB
          </Button>
        )}
      </div>

      {!connected ? (
        /* Empty / Connect Screen */
        <div className="flex-1 bg-surface border border-border rounded-lg flex flex-col items-center justify-center p-8 text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-surface-2 border border-border flex items-center justify-center text-text-3 shadow-inner">
            <DatabaseIcon className="w-8 h-8 text-text-3" />
          </div>
          <div className="max-w-[420px] flex flex-col gap-2">
            <h3 className="text-[14px] font-bold text-text m-0">No SQLite Connection Established</h3>
            <p className="text-[12px] text-text-3 m-0 leading-relaxed">
              Connect to any SQLite database locally to explore its tables, schemas, indexes, and safely run SQL queries in Read-Only mode.
            </p>
          </div>

          <div className="flex flex-col gap-2 w-full max-w-[420px] mt-2">
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-text-3 text-left">
              Quick Connect Suggestions
            </span>
            <div className="grid grid-cols-1 gap-2">
              {internalDbPath && (
                <button
                  onClick={() => handleConnect(internalDbPath)}
                  className="flex items-center justify-between text-left p-2.5 bg-surface-2 hover:bg-surface-3 border border-border rounded-md text-[12px] transition-all font-mono"
                >
                  <span className="text-text font-semibold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green" />
                    Internal App Database
                  </span>
                  <span className="text-text-3 truncate max-w-[200px] text-[10px]">devopslocal.db</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Dynamic Splitscreen Workbench */
        <div className="flex-1 flex gap-4 min-h-0">
          
          {/* Left Panel: Schema List */}
          <div className="w-[280px] bg-surface border border-border rounded-lg flex flex-col min-w-[240px] shrink-0 min-h-0">
            <div className="p-3 border-b border-border-light bg-surface-hi flex flex-col gap-2 shrink-0">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-3">
                Database Schema
              </span>
              <div className="relative flex items-center">
                <span className="absolute left-2.5">
                  <SearchIcon />
                </span>
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Filter tables..."
                  className="w-full bg-surface-2 border border-border rounded pl-8 pr-2.5 py-1 text-[11px] text-text font-mono outline-none focus:border-green focus:ring-1 focus:ring-green/30 transition-colors placeholder:text-text-3"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 select-none">
              {filteredTables.length === 0 ? (
                <div className="text-center py-8 text-[11px] text-text-3 font-mono">
                  No tables found
                </div>
              ) : (
                filteredTables.map((table) => {
                  const isExpanded = !!expandedTables[table.name];
                  return (
                    <div
                      key={table.name}
                      className="flex flex-col rounded border border-transparent hover:border-border-light hover:bg-surface-hi/30 transition-all overflow-hidden"
                    >
                      {/* Table List Item Row */}
                      <div
                        onClick={() => handleTableClick(table.name)}
                        className="flex items-center justify-between p-2 cursor-pointer group"
                      >
                        <span className="flex items-center gap-2 font-mono text-[12px] font-semibold text-text truncate">
                          <TableIcon />
                          <span className="truncate group-hover:text-green transition-colors" title={table.name}>
                            {table.name}
                          </span>
                        </span>
                        <button
                          onClick={(e) => toggleTable(table.name, e)}
                          className="w-5 h-5 rounded hover:bg-surface-3 flex items-center justify-center text-text-3 hover:text-text-2 transition-all border border-transparent hover:border-border"
                          aria-label={isExpanded ? "Collapse schema" : "Expand schema"}
                        >
                          <ChevronRightIcon
                            className={`w-2.5 h-2.5 transform transition-transform duration-150 ${
                              isExpanded ? "rotate-90 text-green" : "text-text-3"
                            }`}
                          />
                        </button>
                      </div>

                      {/* Columns child drawer */}
                      {isExpanded && (
                        <div className="px-2.5 pb-2.5 pt-0.5 border-t border-border-light bg-surface-2/40 flex flex-col gap-1.5">
                          <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-text-3 mb-1">
                            Columns ({table.columns.length})
                          </div>
                          {table.columns.map((col) => (
                            <div
                              key={col.name}
                              className="flex items-center justify-between text-[11px] font-mono text-text-2 hover:text-text"
                            >
                              <span className="flex items-center gap-1 truncate max-w-[150px]">
                                {col.pk && (
                                  <span title="Primary Key" className="shrink-0">
                                    <KeyIcon />
                                  </span>
                                )}
                                <span className={col.pk ? "text-orange font-semibold" : "text-text-2"} title={col.name}>
                                  {col.name}
                                </span>
                              </span>
                              <span
                                className={`text-[9px] px-1 rounded border leading-none py-0.5 shrink-0 select-none ${
                                  col.pk
                                    ? "text-orange bg-orange/5 border-orange/20"
                                    : "text-text-3 bg-surface-3 border-border-light"
                                }`}
                              >
                                {col.data_type}
                                {!col.not_null && "?"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            
            {/* Sidebar metadata footer */}
            {schema && (
              <div className="p-3 border-t border-border-light bg-surface-hi flex items-center justify-between shrink-0 text-[10px] font-mono text-text-3">
                <span>Tables: {schema.tables.length}</span>
                <span className="text-green select-none">● Connected</span>
              </div>
            )}
          </div>

          {/* Right Panel: SQL Editor & Data Spreadsheet */}
          <div className="flex-1 flex flex-col gap-4 min-w-0 min-h-0">
            
            {/* SQL Query Editor Card */}
            <div className="bg-surface border border-border rounded-lg flex flex-col shrink-0 min-h-[180px]">
              {/* Card Title Header with controls */}
              <div className="flex items-center px-4 py-2 border-b border-border-light bg-surface-hi justify-between shrink-0">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-3">
                  SQL Query Editor
                </span>
                
                {/* Presets List */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-text-3 select-none">Presets:</span>
                  <div className="flex gap-1">
                    {[
                      { label: "Active Env Vars", sql: "SELECT * FROM env_vars ORDER BY scope DESC LIMIT 50;" },
                      { label: "App Settings", sql: "SELECT * FROM settings;" },
                      { label: "Sys Migrations", sql: "SELECT * FROM migrations;" },
                      { label: "SQLite Vers", sql: "SELECT sqlite_version();" },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => applyPreset(preset.sql)}
                        className="text-[9px] font-mono px-2 py-0.5 bg-surface-2 hover:bg-surface-3 text-text hover:text-green border border-border hover:border-green-border/30 rounded transition-all select-none"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Textarea Workspace */}
              <div className="flex-1 relative flex">
                {/* Visual Line Number gutter spacer */}
                <div className="w-8 border-r border-border-light bg-surface-2/45 flex flex-col items-center pt-3 text-[10px] font-mono text-text-3 select-none">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <div key={num} className="h-[18px] leading-[18px]">
                      {num}
                    </div>
                  ))}
                </div>
                <textarea
                  value={sql}
                  onChange={(e) => setSql(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-transparent p-3 text-[12px] text-violet font-mono outline-none resize-none leading-[18px] font-medium"
                  placeholder="Enter custom SQL read query here (e.g. SELECT * FROM table;)"
                  spellCheck="false"
                />
              </div>

              {/* Control Bar */}
              <div className="p-2 bg-surface-hi border-t border-border-light flex items-center justify-between shrink-0">
                <span className="text-[10px] font-mono text-text-3 px-2 select-none">
                  Press <kbd className="bg-surface-3 border border-border px-1 rounded text-[9px]">⌘Enter</kbd> to run
                </span>
                <Button
                  onClick={handleRunQuery}
                  loading={executing}
                  variant="primary"
                  size="sm"
                  className="flex items-center gap-1.5 shadow-sm"
                >
                  <PlayIcon />
                  Execute SQL
                </Button>
              </div>
            </div>

            {/* SQL Results Grid Panel */}
            <div className="flex-1 bg-surface border border-border rounded-lg flex flex-col min-h-0 overflow-hidden">
              
              {/* Header Grid Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center px-4 py-2 border-b border-border-light bg-surface-hi justify-between shrink-0 gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-3">
                    Query Results
                  </span>
                  
                  {result && (
                    <div className="flex items-center gap-1.5 font-mono text-[10px] bg-green/10 text-green px-2 py-0.5 rounded border border-green-border/20 select-none">
                      <span>✓ Completed in</span>
                      <span className="font-bold">{result.execution_time_ms} ms</span>
                    </div>
                  )}
                </div>

                {result?.rows && result.rows.length > 0 && (
                  <div className="flex items-center gap-2">
                    {/* Local Filter Grid Search */}
                    <div className="relative flex items-center">
                      <span className="absolute left-2">
                        <SearchIcon />
                      </span>
                      <input
                        type="text"
                        value={gridFilter}
                        onChange={(e) => setGridFilter(e.target.value)}
                        placeholder="Search in results..."
                        className="bg-surface-2 border border-border rounded pl-7 pr-2.5 py-0.5 text-[10px] text-text font-mono outline-none focus:border-green focus:ring-1 focus:ring-green/30 placeholder:text-text-3"
                      />
                    </div>

                    <button
                      onClick={copyAllAsJson}
                      disabled={isCopiedAll}
                      className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 bg-surface-2 hover:bg-surface-3 border border-border hover:border-border-hi text-text-2 hover:text-text rounded transition-all select-none"
                    >
                      {isCopiedAll ? <CheckIcon /> : <CopyIcon />}
                      Copy JSON
                    </button>
                  </div>
                )}
              </div>

              {/* Dynamic View Workspace */}
              <div className="flex-1 overflow-auto relative min-h-0">
                {executing && (
                  <div className="absolute inset-0 bg-surface/85 flex flex-col items-center justify-center gap-3 z-10">
                    <span className="w-8 h-8 border-4 border-green border-t-transparent rounded-full animate-spin" />
                    <span className="font-mono text-[12px] text-text-2 animate-pulse">Running SQL script...</span>
                  </div>
                )}

                {queryError ? (
                  /* Error display box */
                  <div className="p-4 flex gap-3 items-start border-l-4 border-error bg-error-dim/40 m-4 rounded-r-md">
                    <div className="shrink-0 pt-0.5">
                      <AlertCircleIcon />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[12px] font-mono font-bold text-error">Database Query Exception</span>
                      <span className="text-[11px] font-mono text-text-2 leading-relaxed whitespace-pre-wrap">
                        {queryError}
                      </span>
                    </div>
                  </div>
                ) : !result ? (
                  /* Empty state before query */
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center text-text-3 gap-2">
                    <div className="w-10 h-10 rounded-full bg-surface-2 border border-border flex items-center justify-center text-text-3">
                      <PlayIcon />
                    </div>
                    <span className="text-[12px] font-mono">No query executed yet</span>
                  </div>
                ) : filteredRows.length === 0 ? (
                  /* Zero results returning state */
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center text-text-3 gap-2">
                    <div className="w-10 h-10 rounded-full bg-surface-2 border border-border flex items-center justify-center text-text-3 font-bold text-[14px]">
                      0
                    </div>
                    <span className="text-[12px] font-mono">No matching records found</span>
                    {gridFilter && (
                      <button
                        onClick={() => setGridFilter("")}
                        className="text-[11px] text-green hover:underline font-mono"
                      >
                        Clear filter
                      </button>
                    )}
                  </div>
                ) : (
                  /* Grid Spreadsheet Content */
                  <div className="w-full h-full min-w-max">
                    <table className="w-full border-collapse select-text">
                      <thead>
                        <tr className="border-b border-border bg-surface-hi/80 sticky top-0 backdrop-blur-sm z-10 shadow-sm">
                          <th className="w-12 text-center border-r border-border-light px-2 py-2 text-[9px] font-mono uppercase text-text-3">
                            #
                          </th>
                          {result.columns.map((colName) => (
                            <th
                              key={colName}
                              className="text-left border-r border-border-light px-3 py-2 text-[10px] font-mono uppercase tracking-[0.8px] text-text-3 min-w-[120px]"
                            >
                              {colName}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.map((row: any, rIdx) => (
                          <tr
                            key={rIdx}
                            className="border-b border-border-light hover:bg-surface-hi/40 transition-colors"
                          >
                            <td className="w-12 text-center border-r border-border-light px-2 py-1.5 text-[10px] font-mono text-text-3 bg-surface-hi/25 select-none">
                              {rIdx + 1}
                            </td>
                            {result.columns.map((colName, cIdx) => {
                              const rawVal = row[colName];
                              let valStr = "";
                              let isNull = false;
                              
                              if (rawVal === null || rawVal === undefined) {
                                valStr = "NULL";
                                isNull = true;
                              } else if (typeof rawVal === "object") {
                                valStr = JSON.stringify(rawVal);
                              } else {
                                valStr = String(rawVal);
                              }

                              const cellKey = rIdx * 1000 + cIdx;
                              const isCellCopied = copiedIndex === cellKey;

                              return (
                                <td
                                  key={colName}
                                  onDoubleClick={() => copyToClipboard(isNull ? "" : valStr, cellKey)}
                                  className="border-r border-border-light px-3 py-1.5 font-mono text-[12px] truncate max-w-[300px] cursor-pointer group"
                                  title={`${colName}: Double-click to copy cell value`}
                                >
                                  <span
                                    className={`transition-colors duration-150 ${
                                      isNull
                                        ? "text-text-3/60 italic"
                                        : typeof rawVal === "number"
                                        ? "text-violet font-semibold"
                                        : typeof rawVal === "boolean"
                                        ? "text-orange"
                                        : isCellCopied
                                        ? "text-green"
                                        : "text-text-2 group-hover:text-text"
                                    }`}
                                  >
                                    {isCellCopied ? "✓ Copied!" : valStr}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* DataGrid Footer Info */}
              {result && (
                <div className="p-2 border-t border-border-light bg-surface-hi flex items-center justify-between shrink-0 text-[10px] font-mono text-text-3 select-none">
                  <span>
                    Returned {result.rows.length} rows
                    {gridFilter && ` (filtered to ${filteredRows.length})`}
                  </span>
                  <span>Double-click a cell to copy value</span>
                </div>
              )}
            </div>

          </div>

        </div>
      )}
    </div>
  );
}
