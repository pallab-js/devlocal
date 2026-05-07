# Sub-project 4: Data, Logs & Persistence Design

**Goal:** Enhance log viewing capabilities, monitor database health, ensure data safety through backups, and facilitate importing secrets from external orchestrators.

**Architecture:** Frontend enhancements for log rendering and multi-selection. Backend extensions in `crates/db` and `crates/tauri-shell` for DB stats, file-system based backups, and YAML parsing for Kubernetes secrets.

**Tech Stack:** React 19, Tailwind v4, Rust, SQLx, serde_yaml (for K8s secrets).

---

## 1. Log Enhancements

### Search Highlights
Improve visibility of search terms within the log stream.

*   **`packages/desktop/src/pages/Logs.tsx`**: Modify the rendering of the `text` property of a `LogLine`.
*   Create a helper function `highlightText(text: string, query: string)` that returns an array of React nodes, wrapping matches in `<mark className="bg-yellow-500/40 text-yellow-200">`.

### Multi-Container Log View
Allow streaming logs from multiple containers concurrently.

*   **`packages/desktop/src/pages/Logs.tsx`**:
    *   Change state from `selectedId: string` to `selectedIds: string[]`.
    *   Replace the `<select>` with a custom multi-select UI (e.g., a dropdown with checkboxes).
    *   Update `startStream` to iterate over `selectedIds` and call `ipc.streamLogs` for each.
    *   Update the `LogLine` interface and event listener to include a `containerName` field, extracted from the container list based on the ID that emitted the event (requires updating the Rust event payload to include the container ID).

## 2. Database Connection Pool Monitoring

### Backend API
Expose SQLx pool statistics.

*   **`crates/db/src/commands.rs`**: Add a `get_pool_stats(pool: &SqlitePool) -> PoolStats` function. `PoolStats` should include `size`, `idle`, and `wait_timeout`.
*   **`crates/tauri-shell/src/db.rs`**: Expose `get_db_pool_stats` as a Tauri command.

### Frontend UI
*   **`packages/desktop/src/pages/Settings.tsx`**: Add a "Database Health" section under Data. Call the new command periodically (or use the existing stats polling interval) and display the active/idle connection count.

## 3. Automatic DB Backup

### Backend Logic
Implement automated daily backups and retention policy.

*   **`crates/db/src/lib.rs`**: Add an `auto_backup(db_path: &Path)` function.
    *   Create a `backups` directory next to `devopslocal.db`.
    *   Copy `devopslocal.db` to `backups/devopslocal-YYYYMMDD.db`.
    *   Read the `backups` directory, sort by modification time, and delete files exceeding the retention limit (e.g., 7 days).
    *   Call `auto_backup` inside `init` before migrations run.

### Frontend Integration (Optional but recommended)
*   **`crates/tauri-shell/src/db.rs`**: Add commands to list available backups and restore a specific backup (requires shutting down the pool, copying the file, and requesting an app restart).
*   **`packages/desktop/src/pages/Settings.tsx`**: Add a "Restore Backup" section.

## 4. Import Secrets (Docker/K8s)

### Backend API
Parse secret files into environment variables.

*   **`crates/db/src/commands.rs`**: Add `import_secrets(content, format, scope)`.
    *   Add `serde_yaml` to `crates/db/Cargo.toml`.
    *   If `format == "kubernetes"`, parse the content as a generic YAML map. Extract the `data` field, base64 decode the values, and map them to `EnvVar`s.
    *   If `format == "docker"`, reuse the existing env file parser.

### Frontend UI
*   **`packages/desktop/src/pages/Environments.tsx`**: Add a split button or dropdown to the "Import" action, offering "Import Env File", "Import K8s Secret", and "Import Docker Secrets".
