# Architecture

```
React UI  ──invoke──▶  Tauri Commands  ──▶  Rust Modules  ──▶  OS / Docker Socket
          ◀──events──                   ◀──
```

## Layers

**UI** (`src/`) — React 19 pages + components. State via Zustand slices; async data via TanStack Query wrapping IPC calls.

**IPC** — `src/lib/ipc.ts` typed wrappers over `@tauri-apps/api/core` `invoke`. Events via `@tauri-apps/api/event` `listen`.

**Rust Core** (`src-tauri/src/`)
- `docker/` — bollard SDK: list/start/stop containers, host stats, network topology, log streaming
- `db/` — SQLx + SQLite: env var CRUD, migrations in `migrations/`

**Storage** — SQLite at `$APP_DATA_DIR/devopslocal.db`. No remote storage.

## Key Design Decisions

- **No Electron** — Tauri gives a ~10MB binary vs ~150MB for Electron
- **bollard not shelling out** — type-safe async Docker API, works on Unix socket + Windows named pipe
- **SQLx compile-time queries** — type-checked SQL at build time
- **Tailwind v4 CSS-first** — design tokens in `@theme` block, no JS config file
