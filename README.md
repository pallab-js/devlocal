<div align="center">

# DevOpsLocal

**A local-first DevOps desktop app for managing your Docker environment — no cloud, no accounts, no telemetry.**

[![CI](https://github.com/pallab-js/devlocal/actions/workflows/ci.yml/badge.svg)](https://github.com/pallab-js/devlocal/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Built with Tauri v2 · Rust · React 19 · Tailwind v4

</div>

---

## Overview

DevOpsLocal is a lightweight desktop app for developers who want full control over their local
Docker environment from a single native window. Everything runs on your machine and talks directly
to the Docker socket — there is no backend server, no account, and no internet requirement.

The Rust core produces a ~10 MB binary (versus ~150 MB for an equivalent Electron app) and talks to
Docker through the type-safe [bollard](https://github.com/fussybeaver/bollard) SDK rather than
shelling out to the CLI.

## Features

| Area | What it does |
|------|--------------|
| **Dashboard** | Live container list with start / stop / restart, per-container CPU & memory, and host CPU / RAM / disk monitoring. Debounced search. |
| **Images** | List, pull (with per-layer progress), delete, and prune images. |
| **Volumes** | List and prune volumes; inspect full volume detail. |
| **Network** | Docker network topology with per-network container, subnet, and gateway details. |
| **Logs** | Real-time log streaming with virtual scrolling, level filter, and export (clipboard or file). |
| **Environments** | SQLite-backed env var manager scoped to `global` / `development` / `staging` / `production`. Import & export `.env` files; import Kubernetes / Docker secrets. Secret values are stored in the OS keychain. |
| **Database** | Read-only SQLite explorer — browse schema and run `SELECT` queries. |
| **Settings** | Docker connection health check, polling-interval configuration, and app info. |

Additional niceties: Docker Compose up/down, a live Docker event stream, light/dark theme,
keyboard shortcuts (`Cmd/Ctrl+1–5`), i18n scaffolding, and a system tray icon.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop shell | [Tauri v2](https://tauri.app) (Rust) |
| Frontend | React 19 · Vite 7 · TypeScript 5 |
| Styling | Tailwind CSS v4 (CSS-first, no JS config) |
| State / data | Zustand v5 · TanStack Query v5 |
| Local DB | SQLite via SQLx (compile-time-checked queries) |
| Docker API | [bollard](https://github.com/fussybeaver/bollard) (async Docker SDK) |
| Secrets | OS keychain via [`keyring`](https://crates.io/crates/keyring) |
| Testing | Vitest · Testing Library · `cargo test` · proptest |

## Getting Started

### Prerequisites

- **Node.js** 22+ and **pnpm** 10+
- **Rust** 1.80+ (install via [`rustup`](https://rustup.rs))
- **Docker** running locally

> The app launches even when Docker is not running — Docker-dependent views show a clear
> connection error instead of crashing.

### Run in development

```bash
git clone https://github.com/pallab-js/devlocal.git
cd devlocal
pnpm install
pnpm tauri dev
```

### Build a release

```bash
pnpm tauri build
```

The native installer is written to `packages/desktop/src-tauri/target/release/bundle/`.

## Project Structure

```
devlocal/
├── crates/
│   ├── docker-ops/      # bollard: containers, stats, logs, events, networks, images, volumes
│   ├── db/              # SQLx: env var CRUD, settings, keychain, SQLite explorer, migrations
│   └── tauri-shell/     # Tauri commands (IPC layer) + app wiring
├── packages/
│   ├── desktop/         # Vite + React app and the Tauri project (src-tauri/)
│   │   └── src/
│   │       ├── pages/        # Dashboard, Images, Volumes, Network, Logs, Environments, Database, Settings
│   │       ├── components/   # Shared UI + ErrorBoundary
│   │       ├── hooks/        # TanStack Query hooks
│   │       └── lib/ipc.ts    # Typed Tauri IPC wrappers
│   └── shared/          # TypeScript types generated from Rust via ts-rs
└── .github/workflows/   # CI: lint → test → audit → build
```

## Architecture

```
React UI ──invoke──▶ Tauri Commands ──▶ Rust crates ──▶ OS / Docker socket
         ◀──events──                 ◀──
```

- **IPC** — `src/lib/ipc.ts` wraps `@tauri-apps/api/core` `invoke` with fully typed functions.
  Streaming data (log lines, Docker events, pull progress) arrives via `@tauri-apps/api/event`
  `listen`.
- **Types** — Rust structs are annotated with [`ts-rs`](https://crates.io/crates/ts-rs) and
  exported to `packages/shared/types/` during `cargo test`, keeping the Rust and TypeScript sides
  in sync.
- **Storage** — SQLite at `$APP_DATA_DIR/devopslocal.db`, schema managed by SQLx migrations, with a
  daily on-startup backup (7-day retention).

See [ARCHITECTURE.md](ARCHITECTURE.md) for design decisions.

## Security

- **Secrets in the OS keychain.** Env vars whose key contains a sensitive segment
  (`secret`, `password`, `token`, `key`, `pwd`, `pass`, `auth`, `credential`) are stored in the OS
  keychain, not in SQLite. Matching is segment-based, so keys such as `PUBLIC_KEY`, `MONKEY`, or
  `BYPASS_CACHE` are correctly treated as non-sensitive.
- **Parameterized SQL.** All queries use bound parameters. The Database explorer connects read-only.
- **Server-side validation.** Env var keys must be alphanumeric/underscore and start with a letter
  or underscore; scopes are checked against an allowlist; settings keys are allowlisted.
- **Tight CSP & capabilities.** The webview CSP restricts sources to `self`/IPC, and Tauri
  capabilities grant only the dialog and file-write permissions the app needs.

> **Note:** signed auto-updates are not yet enabled. The updater plugin is a dependency but is not
> configured; before shipping, register the plugin and set `plugins.updater.pubkey` in
> `tauri.conf.json` (generate a key with `tauri signer generate`).

## Development

```bash
# Frontend
pnpm --filter @devopslocal/desktop test          # unit tests (Vitest)
pnpm --filter @devopslocal/desktop test:watch     # watch mode
pnpm --filter @devopslocal/desktop lint           # tsc --noEmit + eslint

# Rust
cargo test --workspace                            # unit + integration tests
cargo clippy --workspace -- -D warnings           # lints
cargo audit                                        # dependency security audit
```

All pull requests must pass CI before merge.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and follow the
[Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE)

---

<div align="center">

### Repository metadata

**Description**
> Local-first Docker management desktop app built with Tauri v2, Rust, and React 19 — containers, images, volumes, networks, logs, env/secrets, and a SQLite explorer, all offline.

**Topics**
`tauri` · `rust` · `react` · `typescript` · `docker` · `devops` · `desktop-app`
· `local-first` · `tauri-v2` · `bollard` · `sqlite` · `sqlx` · `tailwindcss` · `vite`
· `container-management` · `cross-platform`

</div>
