# Data, Logs & Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance log visibility, monitor DB health, implement automated backups, and expand secret import capabilities.

**Architecture:** Frontend enhancements for log rendering and multi-selection. Backend extensions in `db` and `tauri-shell` for DB stats, file-system based backups, and YAML parsing.

**Tech Stack:** React 19, Tailwind v4, Rust, SQLx, serde_yaml.

---

## Task 1: Log Search Highlights

**Files:**
- Modify: `packages/desktop/src/pages/Logs.tsx`

- [ ] **Step 1: Implement `highlightText` helper**
Add a function that splits text by a query string and wraps matches in `<mark>` tags.

- [ ] **Step 2: Update Log Rendering**
Modify the `visible.map` loop to apply `highlightText` to the line content.

- [ ] **Step 3: Commit**
```bash
git add packages/desktop/src/pages/Logs.tsx
git commit -m "feat: add search highlights to logs"
```

---

## Task 2: Multi-Container Log View

**Files:**
- Modify: `crates/docker-ops/src/lib.rs`
- Modify: `crates/tauri-shell/src/docker.rs`
- Modify: `packages/desktop/src/pages/Logs.tsx`

- [ ] **Step 1: Include Container ID in Log Event**
Update the backend log streaming to include the `container_id` in the emitted event payload.

- [ ] **Step 2: Update Frontend State**
Change `selectedId` to `selectedIds: string[]`. Implement a multi-select dropdown or checkbox list.

- [ ] **Step 3: Update Streaming Logic**
Modify `useEffect` to start/stop streams for all IDs in `selectedIds`. Prefix log lines with the container name.

- [ ] **Step 4: Commit**
```bash
git add crates/ packages/desktop
git commit -m "feat: implement multi-container log view"
```

---

## Task 3: DB Connection Pool Monitoring

**Files:**
- Modify: `crates/db/src/lib.rs`
- Modify: `crates/tauri-shell/src/db.rs`
- Modify: `packages/desktop/src/pages/Settings.tsx`

- [ ] **Step 1: Implement `get_db_pool_stats`**
Add backend command to return `size` and `idle` connection counts from the SQLx pool.

- [ ] **Step 2: Add UI to Settings**
Display the pool stats in a new "Database Health" section.

- [ ] **Step 3: Commit**
```bash
git add crates/ packages/desktop
git commit -m "feat: add database connection pool monitoring"
```

---

## Task 4: Automatic DB Backup & Retention

**Files:**
- Modify: `crates/db/src/lib.rs`

- [x] **Step 1: Implement `auto_backup`**
Add logic to `db::init` to copy the DB file to a `backups/` folder and prune files older than 7 days.

- [x] **Step 2: Add Restore Command**
(Optional) Implement a command to list and restore from a backup.

- [x] **Step 3: Commit**
```bash
git add crates/db/src/lib.rs
git commit -m "feat: implement automatic daily DB backups"
```

---

## Task 5: Import Secrets (Docker/K8s)

**Files:**
- Modify: `crates/db/Cargo.toml`
- Modify: `crates/db/src/commands.rs`
- Modify: `packages/desktop/src/pages/Environments.tsx`

- [ ] **Step 1: Add `serde_yaml`**
Add the dependency to `crates/db`.

- [ ] **Step 2: Implement `import_secrets` backend**
Add logic to parse Kubernetes Secret YAML (decoding base64 `data`) and Docker secret files.

- [ ] **Step 3: Add UI Dropdown**
Implement the "Import Secrets" dropdown menu in the Environments page.

- [ ] **Step 4: Commit**
```bash
git add crates/ packages/desktop
git commit -m "feat: support importing K8s and Docker secrets"
```
