import { useState, useRef } from "react";
import { useEnvVars, useEnvVarMutations } from "../hooks/useQueries";
import { useToast } from "../components/Toast";
import { ipc } from "../lib/ipc";
import { Skeleton } from "../components/Skeleton";
import type { EnvVar } from "../lib/ipc";

const SCOPES = ["global", "development", "staging", "production"];

const SENSITIVE_RE = /secret|password|token|key|pwd|pass|auth|credential/i;

export function Environments() {
  const [scope, setScope] = useState("global");
  const [form, setForm] = useState({ key: "", value: "", scope: "global" });
  const [editing, setEditing] = useState<EnvVar | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EnvVar | null>(null);
  const [search, setSearch] = useState("");
  const [masked, setMasked] = useState<Set<number>>(new Set());
  const [formError, setFormError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: vars, isLoading } = useEnvVars(scope);
  const { upsert, remove } = useEnvVarMutations();

  // Auto-mask sensitive keys on load
  function toggleMask(id: number) {
    setMasked(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function isMasked(v: EnvVar) {
    return !masked.has(v.id) && SENSITIVE_RE.test(v.key);
  }

  function validate(key: string): string {
    if (!key.trim()) return "Key is required.";
    if (/\s/.test(key)) return "Key must not contain spaces.";
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return "Key must be alphanumeric/underscore, starting with a letter or underscore.";
    return "";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const key = editing ? editing.key : form.key;
    const value = editing ? editing.value : form.value;
    // Fix: use editing.scope when editing, not form.scope
    const targetScope = editing ? editing.scope : form.scope;
    const err = validate(key);
    if (err) { setFormError(err); return; }
    setFormError("");
    upsert.mutate(
      { key, value, scope: targetScope },
      { onSuccess: () => { setForm({ key: "", value: "", scope: "global" }); setEditing(null); } }
    );
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    try {
      const count = await ipc.importEnvFile(content, scope);
      toast(`Imported ${count} variable(s) into "${scope}".`, "success");
    } catch (err) {
      toast(String(err), "error");
    }
    // reset file input
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleImportContent(content: string) {
    try {
      const count = await ipc.importEnvFile(content, scope);
      toast(`Imported ${count} variable(s) into "${scope}".`, "success");
    } catch (err) {
      toast(String(err), "error");
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

  // Feature 7.6: drag-and-drop
  const [dragging, setDragging] = useState(false);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave() {
    setDragging(false);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const content = await file.text();
    await handleImportContent(content);
  }

  const filtered = vars?.filter(v =>
    !search || v.key.toLowerCase().includes(search.toLowerCase()) || v.value.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "1.5rem", position: "relative" }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragging && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            border: "3px dashed var(--green)",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            pointerEvents: "none",
          }}
        >
          <span style={{ fontSize: 18, color: "var(--green)", fontWeight: 600 }}>
            Drop .env file to import
          </span>
        </div>
      )}
      <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", margin: 0 }}>Environments</h1>

      {/* Scope filter + import/export */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        {SCOPES.map((s) => (
          <button key={s} onClick={() => setScope(s)} style={{
            fontSize: 11, padding: "4px 12px", borderRadius: 9999,
            border: `1px solid ${scope === s ? "var(--green-border)" : "var(--border)"}`,
            background: scope === s ? "var(--green-dim)" : "var(--surface)",
            color: scope === s ? "var(--green)" : "var(--text-3)",
            cursor: "pointer", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.8px",
          }}>{s}</button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <label style={{
            fontSize: 11, padding: "4px 12px", borderRadius: 4,
            border: "1px solid var(--border)", background: "var(--surface)",
            color: "var(--text-3)", cursor: "pointer", fontFamily: "var(--font-mono)",
          }}>
            ↑ Import .env
            <input ref={fileRef} type="file" accept=".env,text/plain" onChange={handleImport} style={{ display: "none" }} />
          </label>
          <button onClick={handleExport} style={{
            fontSize: 11, padding: "4px 12px", borderRadius: 4,
            border: "1px solid var(--border)", background: "var(--surface)",
            color: "var(--text-3)", cursor: "pointer", fontFamily: "var(--font-mono)",
          }}>↓ Export .env</button>
        </div>
      </div>

      {/* Add / Edit form */}
      <form onSubmit={handleSubmit} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <Field label="Key" value={editing ? editing.key : form.key}
            onChange={(v) => { setFormError(""); if (editing) { setEditing({ ...editing, key: v }); } else { setForm({ ...form, key: v }); } }}
            placeholder="API_KEY" disabled={!!editing} />
          <Field label="Value" value={editing ? editing.value : form.value}
            onChange={(v) => editing ? setEditing({ ...editing, value: v }) : setForm({ ...form, value: v })}
            placeholder="secret" type="password" />
          {!editing && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={labelStyle}>Scope</label>
              <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} style={inputStyle}>
                {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          {editing && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={labelStyle}>Scope</label>
              <span style={{ ...inputStyle, color: "var(--text-3)", opacity: 0.7 }}>{editing.scope}</span>
            </div>
          )}
          <button type="submit" style={submitBtn} disabled={upsert.isPending}>{editing ? "Update" : "Add"}</button>
          {editing && (
            <button type="button" onClick={() => { setEditing(null); setFormError(""); }} style={{ ...submitBtn, background: "var(--surface-2)", color: "var(--text-3)", borderColor: "var(--border)" }}>Cancel</button>
          )}
        </div>
        {formError && <p style={{ color: "var(--error)", fontSize: 12, margin: 0 }}>{formError}</p>}
      </form>

      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by key or value…"
        style={{ ...inputStyle, width: "100%", maxWidth: 320 }}
      />

      {/* Table */}
      <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
        {isLoading && (
          <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: 10 }}>
            {[0,1,2].map(i => <Skeleton key={i} height={36} />)}
          </div>
        )}
        {!isLoading && filtered?.length === 0 && (
          <p style={{ padding: "1rem", color: "var(--text-3)", fontSize: 13 }}>
            {search ? "No variables match your search." : "No variables in this scope."}
          </p>
        )}
        {filtered && filtered.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Key", "Value", "Scope", ""].map((h, i) => (
                  <th key={i} style={{ textAlign: "left", padding: "8px 12px", fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-3)", background: "var(--surface-hi)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "9px 12px", color: "var(--green)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{v.key}</td>
                  <td style={{ padding: "9px 12px", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "var(--text-2)", letterSpacing: isMasked(v) ? "0.15em" : "normal" }}>
                        {isMasked(v) ? "••••••••" : v.value}
                      </span>
                      <button
                        onClick={() => toggleMask(v.id)}
                        style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 11, padding: 0, fontFamily: "var(--font-mono)" }}
                        title={isMasked(v) ? "Show" : "Hide"}
                      >
                        {isMasked(v) ? "show" : "hide"}
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: "9px 12px", color: "var(--text-3)", fontFamily: "var(--font-mono)", fontSize: 11 }}>{v.scope}</td>
                  <td style={{ padding: "9px 12px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => { setEditing(v); setFormError(""); }} style={actionBtn("var(--violet)")}>Edit</button>
                      <button onClick={() => setConfirmDelete(v)} style={actionBtn("var(--error)")}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div onClick={() => setConfirmDelete(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "1.5rem", width: 360 }}>
            <p style={{ color: "var(--text)", fontSize: 14, fontWeight: 600, margin: "0 0 8px" }}>Delete variable?</p>
            <p style={{ color: "var(--text-3)", fontSize: 13, margin: "0 0 1.25rem" }}>
              <code style={{ color: "var(--green)", fontFamily: "var(--font-mono)" }}>{confirmDelete.key}</code> in <em>{confirmDelete.scope}</em> will be permanently deleted.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: "6px 14px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-2)", cursor: "pointer", fontSize: 12 }}>Cancel</button>
              <button onClick={() => { remove.mutate(confirmDelete.id); setConfirmDelete(null); }} style={{ padding: "6px 14px", borderRadius: 4, border: "1px solid var(--error)", background: "var(--error-dim)", color: "var(--error)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, disabled, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; disabled?: boolean; type?: string;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: "flex", gap: 0 }}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          type={isPassword && !show ? "password" : "text"}
          style={{ ...inputStyle, opacity: disabled ? 0.5 : 1, borderRadius: isPassword ? "4px 0 0 4px" : 4 }}
        />
        {isPassword && (
          <button type="button" onClick={() => setShow(s => !s)} style={{ padding: "0 8px", background: "var(--surface-3)", border: "1px solid var(--border)", borderLeft: "none", borderRadius: "0 4px 4px 0", color: "var(--text-3)", cursor: "pointer", fontSize: 11, fontFamily: "var(--font-mono)" }}>
            {show ? "hide" : "show"}
          </button>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-3)" };
const inputStyle: React.CSSProperties = { background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 4, padding: "6px 10px", color: "var(--text)", fontSize: 12, fontFamily: "var(--font-mono)", outline: "none", minWidth: 160 };
const submitBtn: React.CSSProperties = { padding: "7px 16px", borderRadius: 4, border: "1px solid var(--green-border)", background: "var(--green-dim)", color: "var(--green)", cursor: "pointer", fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 600 };
const actionBtn = (color: string): React.CSSProperties => ({ fontSize: 11, padding: "2px 8px", borderRadius: 4, border: `1px solid ${color}`, background: "transparent", color, cursor: "pointer", fontFamily: "var(--font-mono)" });
