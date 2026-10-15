import { useState, useRef } from "react";
import { useEnvVars, useEnvVarMutations } from "../hooks/useQueries";
import { useToast } from "../components/Toast";
import { ipc, isAppError } from "../lib/ipc";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { Skeleton } from "../components/Skeleton";
import { useDebounce } from "../hooks/useDebounce";
import type { EnvVar } from "../lib/ipc";
import { Button } from "../components/ui/Button";
import { ConfirmModal } from "../components/ui/Modal";

const SCOPES = ["global", "development", "staging", "production"];
// Keep in sync with `is_sensitive` in crates/db/src/lib.rs: match whole
// underscore-delimited segments, and treat PUBLIC_KEY / *_PUB as non-sensitive.
const SENSITIVE_SEGMENTS = new Set([
  "secret", "password", "token", "key", "pwd", "pass", "auth", "credential", "credentials",
]);
const PUBLIC_SEGMENTS = new Set(["public", "pub"]);

function isSensitiveKey(key: string): boolean {
  const segments = key.toLowerCase().split("_").filter(Boolean);
  if (segments.some((s) => PUBLIC_SEGMENTS.has(s))) return false;
  return segments.some((s) => SENSITIVE_SEGMENTS.has(s));
}

/** Build a human-readable import summary, naming any skipped keys. */
function importSummary(imported: number, skipped: string[], scope: string): string {
  const base = `Imported ${imported} variable(s) into "${scope}".`;
  if (!skipped.length) return base;
  const preview = skipped.slice(0, 5).join(", ");
  const more = skipped.length > 5 ? ` (+${skipped.length - 5} more)` : "";
  return `${base} Skipped ${skipped.length} invalid key(s): ${preview}${more}.`;
}

export function Environments() {
  const [scope, setScope] = useState("global");
  const [form, setForm] = useState({ key: "", value: "", scope: "global" });
  const [editing, setEditing] = useState<EnvVar | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EnvVar | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [masked, setMasked] = useState<Set<number>>(new Set());
  const [formError, setFormError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const { toast } = useToast();

  const { data: vars, isLoading } = useEnvVars(scope);
  const { upsert, remove } = useEnvVarMutations();

  function toggleMask(id: number) {
    setMasked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function isMasked(v: EnvVar) {
    return !masked.has(v.id) && isSensitiveKey(v.key);
  }

  function validate(key: string): string {
    if (!key.trim()) return "Key is required.";
    if (/\s/.test(key)) return "Key must not contain spaces.";
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key))
      return "Key must be alphanumeric/underscore, starting with a letter or underscore.";
    return "";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const key = editing ? editing.key : form.key;
    const value = editing ? editing.value : form.value;
    const targetScope = editing ? editing.scope : form.scope;
    const err = validate(key);
    if (err) { setFormError(err); return; }
    setFormError("");
    upsert.mutate(
      { key, value, scope: targetScope },
      {
        onSuccess: () => { setForm({ key: "", value: "", scope: "global" }); setEditing(null); },
        onError: (e) => {
          // A server-side validation failure belongs on the form; anything
          // else (storage/keychain) is surfaced as a toast.
          if (isAppError(e) && e.code === "Validation") {
            setFormError(e.message);
          } else {
            toast(isAppError(e) ? e.message : String(e), "error");
          }
        },
      },
    );
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    try {
      const { imported, skipped } = await ipc.importEnvFile(content, scope);
      toast(importSummary(imported, skipped, scope), skipped.length ? "info" : "success");
    } catch (err) {
      toast(String(err), "error");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleImportSecrets(format: "docker" | "kubernetes") {
    try {
      const path = await open({
        multiple: false,
        filters: [{
          name: format === "kubernetes" ? "YAML" : "Docker Secret/Env",
          extensions: format === "kubernetes" ? ["yaml", "yml"] : ["*", "env"],
        }],
      });
      if (!path || Array.isArray(path)) return;
      const content = await readTextFile(path);
      const { imported, skipped } = await ipc.importSecrets(content, format, scope);
      toast(importSummary(imported, skipped, scope), skipped.length ? "info" : "success");
    } catch (err) {
      toast(String(err), "error");
    } finally {
      setImportMenuOpen(false);
    }
  }

  async function handleExport() {
    try {
      const content = await ipc.exportEnvScope(scope);
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${scope}.env`; a.click();
      URL.revokeObjectURL(url);
      toast(`Exported "${scope}" env vars.`, "success");
    } catch (err) {
      toast(String(err), "error");
    }
  }

  const [dragging, setDragging] = useState(false);

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const content = await file.text();
    try {
      const { imported, skipped } = await ipc.importEnvFile(content, scope);
      toast(importSummary(imported, skipped, scope), skipped.length ? "info" : "success");
    } catch (err) {
      toast(String(err), "error");
    }
  }

  const filtered = vars?.filter((v) =>
    !debouncedSearch ||
    v.key.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    v.value.toLowerCase().includes(debouncedSearch.toLowerCase()),
  );

  return (
    <div
      className="flex flex-col gap-5 relative"
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {dragging && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          style={{ background: "rgba(0,0,0,0.7)", border: "3px dashed var(--green)", borderRadius: 12 }}
          aria-hidden="true"
        >
          <span className="text-[18px] text-green font-semibold">Drop .env file to import</span>
        </div>
      )}

      <h1 className="text-[18px] font-bold text-text m-0">Environments</h1>

      {/* Scope filter + import/export */}
      <div className="flex gap-2 items-center flex-wrap">
        {SCOPES.map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={`text-[11px] px-3 py-1 rounded-full border font-mono uppercase tracking-[0.8px] transition-colors cursor-pointer ${
              scope === s
                ? "border-green-border bg-green-dim text-green"
                : "border-border bg-surface text-text-3 hover:text-text-2 hover:bg-surface-2"
            }`}
          >
            {s}
          </button>
        ))}

        <div className="ml-auto flex gap-2 relative">
          {/* Import split button */}
          <div className="flex rounded border border-border overflow-hidden">
            <button
              onClick={() => fileRef.current?.click()}
              className="text-[11px] px-3 py-1 bg-surface text-text-3 hover:text-text-2 hover:bg-surface-2 font-mono border-r border-border cursor-pointer transition-colors"
            >
              ↑ Import
            </button>
            <button
              onClick={() => setImportMenuOpen(!importMenuOpen)}
              className="text-[11px] px-2 py-1 bg-surface text-text-3 hover:text-text-2 hover:bg-surface-2 font-mono cursor-pointer transition-colors"
              aria-label="More import options"
              aria-expanded={importMenuOpen}
            >
              {importMenuOpen ? "▲" : "▼"}
            </button>
            <input ref={fileRef} type="file" accept=".env,text/plain" onChange={handleImport} className="hidden" />
          </div>

          {importMenuOpen && (
            <div className="absolute top-full left-0 mt-1 bg-surface border border-border rounded-md shadow-lg z-10 min-w-[180px] overflow-hidden">
              <button onClick={() => { fileRef.current?.click(); setImportMenuOpen(false); }} className="block w-full px-3 py-2 text-[11px] font-mono text-text-2 hover:bg-surface-2 text-left cursor-pointer transition-colors">.env File</button>
              <button onClick={() => handleImportSecrets("kubernetes")} className="block w-full px-3 py-2 text-[11px] font-mono text-text-2 hover:bg-surface-2 text-left cursor-pointer transition-colors">Kubernetes Secret (YAML)</button>
              <button onClick={() => handleImportSecrets("docker")} className="block w-full px-3 py-2 text-[11px] font-mono text-text-2 hover:bg-surface-2 text-left cursor-pointer transition-colors">Docker Secret (Env)</button>
            </div>
          )}

          <button
            onClick={handleExport}
            className="text-[11px] px-3 py-1 rounded border border-border bg-surface text-text-3 hover:text-text-2 hover:bg-surface-2 font-mono cursor-pointer transition-colors"
          >
            ↓ Export .env
          </button>
        </div>
      </div>

      {/* Add / Edit form */}
      <form
        onSubmit={handleSubmit}
        className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-3"
      >
        <div className="flex gap-3 items-end flex-wrap">
          <Field
            label="Key"
            value={editing ? editing.key : form.key}
            onChange={(v) => {
              setFormError("");
              if (editing) {
                setEditing({ ...editing, key: v });
              } else {
                setForm({ ...form, key: v });
              }
            }}
            placeholder="API_KEY"
            disabled={!!editing}
          />
          <Field
            label="Value"
            value={editing ? editing.value : form.value}
            onChange={(v) => editing ? setEditing({ ...editing, value: v }) : setForm({ ...form, value: v })}
            placeholder="secret"
            type="password"
          />
          {!editing && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono uppercase tracking-[0.8px] text-text-3">Scope</label>
              <select
                value={form.scope}
                onChange={(e) => setForm({ ...form, scope: e.target.value })}
                className="bg-surface-2 border border-border rounded px-2.5 py-1.5 text-[12px] text-text font-mono outline-none focus:border-green focus:ring-1 focus:ring-green/30 transition-colors"
              >
                {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          {editing && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono uppercase tracking-[0.8px] text-text-3">Scope</label>
              <span className="text-[12px] font-mono text-text-3 px-2.5 py-1.5 bg-surface-2 rounded border border-border">{editing.scope}</span>
            </div>
          )}
          <Button type="submit" variant="primary" size="sm" loading={upsert.isPending}>
            {editing ? "Update" : "Add"}
          </Button>
          {editing && (
            <Button type="button" variant="secondary" size="sm" onClick={() => { setEditing(null); setFormError(""); }}>
              Cancel
            </Button>
          )}
        </div>
        {formError && <p className="text-error text-[12px] m-0">{formError}</p>}
      </form>

      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by key or value…"
        className="bg-surface-2 border border-border rounded px-3 py-1.5 text-[12px] text-text font-mono outline-none focus:border-green focus:ring-1 focus:ring-green/30 transition-colors placeholder:text-text-3 w-full max-w-xs"
      />

      {/* Table */}
      <section className="bg-surface border border-border rounded-lg overflow-hidden">
        {isLoading && (
          <div className="p-4 flex flex-col gap-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} height={36} />)}
          </div>
        )}
        {!isLoading && filtered?.length === 0 && (
          <p className="p-4 text-text-3 text-[13px]">
            {search ? "No variables match your search." : "No variables in this scope."}
          </p>
        )}
        {filtered && filtered.length > 0 && (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-hi">
                {["Key", "Value", "Scope", ""].map((h, i) => (
                  <th key={i} className="text-left px-3 py-2.5 text-[10px] font-mono uppercase tracking-[0.8px] text-text-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v.id} className="border-b border-border-light hover:bg-surface-hi/50 transition-colors">
                  <td className="px-3 py-2.5 text-green font-mono text-[12px]">{v.key}</td>
                  <td className="px-3 py-2.5 font-mono text-[12px]">
                    <div className="flex items-center gap-2">
                      <span className={`text-text-2 ${isMasked(v) ? "tracking-[0.15em]" : ""}`}>
                        {isMasked(v) ? "••••••••" : v.value}
                      </span>
                      <button
                        onClick={() => toggleMask(v.id)}
                        className="text-text-3 hover:text-text-2 text-[11px] font-mono cursor-pointer border-none bg-transparent p-0 transition-colors"
                        aria-label={isMasked(v) ? `Show value for ${v.key}` : `Hide value for ${v.key}`}
                      >
                        {isMasked(v) ? "show" : "hide"}
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-text-3 font-mono text-[11px]">{v.scope}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-2">
                      <Button
                        onClick={() => { setEditing(v); setFormError(""); }}
                        variant="ghost"
                        size="sm"
                        className="text-violet hover:text-violet"
                        aria-label={`Edit ${v.key}`}
                      >
                        Edit
                      </Button>
                      <Button
                        onClick={() => setConfirmDelete(v)}
                        variant="danger"
                        size="sm"
                        aria-label={`Delete ${v.key}`}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Delete confirmation modal */}
      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) {
            remove.mutate({ id: Number(confirmDelete.id), scope: confirmDelete.scope });
            setConfirmDelete(null);
          }
        }}
        title="Delete variable?"
        message={`"${confirmDelete?.key}" in ${confirmDelete?.scope} will be permanently deleted.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

function Field({ label, value, onChange, placeholder, disabled, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; disabled?: boolean; type?: string;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const inputId = `env-field-${label.toLowerCase()}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-[10px] font-mono uppercase tracking-[0.8px] text-text-3">
        {label}
      </label>
      <div className="flex">
        <input
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          type={isPassword && !show ? "password" : "text"}
          className={`bg-surface-2 border border-border text-[12px] text-text font-mono px-2.5 py-1.5 outline-none focus:border-green focus:ring-1 focus:ring-green/30 transition-colors placeholder:text-text-3 min-w-[140px] disabled:opacity-50 disabled:cursor-not-allowed ${isPassword ? "rounded-l" : "rounded"}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide value" : "Show value"}
            className="px-2 bg-surface-3 border border-l-0 border-border rounded-r text-text-3 hover:text-text-2 cursor-pointer text-[11px] font-mono transition-colors"
          >
            {show ? "hide" : "show"}
          </button>
        )}
      </div>
    </div>
  );
}
