# DevOpsLocal

> Open-source, local-first DevOps desktop suite — Tauri v2 + Rust + React 19 + Tailwind v4

[![CI](https://github.com/pallab-js/devlocal/actions/workflows/ci.yml/badge.svg)](https://github.com/pallab-js/devlocal/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A lightweight desktop app for developers who want full control over their local Docker environments — no cloud, no telemetry, no bloat.

---

## Features

| Feature | Description |
|---|---|
| **Dashboard** | Live container list with start / stop / restart controls, host CPU / RAM / disk monitor |
| **Network** | Docker network topology viewer with per-network container details |
| **Environments** | SQLite-backed env var manager with scopes: `global`, `dev`, `staging`, `prod` — import/export `.env` files |
| **Logs** | Real-time container log streaming with `INFO` / `WARN` / `ERROR` filter and tail control |
| **Settings** | Docker socket configuration, app info, connection health check |

All data stays on your machine. No accounts, no internet required.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | [Tauri v2](https://tauri.app) (Rust) |
| Frontend | React 19 + Vite 7 + TypeScript 5 |
| Styling | Tailwind CSS v4 (CSS-first, no JS config) |
| State | Zustand v5 + TanStack Query v5 |
| Local DB | SQLite via SQLx (compile-time checked queries) |
| Container API | [bollard](https://github.com/fussybeaver/bollard) — async Docker SDK for Rust |
| Testing | Vitest + Testing Library |

---

## Prerequisites

- **Node.js** 22+ and **pnpm** 10+
- **Rust** 1.80+ (`rustup` recommended)
- **Docker** daemon running locally

---

## Getting Started

```bash
git clone https://github.com/pallab-js/devlocal.git
cd devlocal
pnpm install
pnpm tauri dev
```

The app window opens automatically. The app will start successfully even if Docker is not running, displaying appropriate error messages in the UI when Docker features are accessed.

### Production Build

```bash
pnpm tauri build
```

Produces a native installer in `src-tauri/target/release/bundle/`.

---

## Development

```bash
# Frontend unit tests
pnpm --filter @devopslocal/desktop test

# Frontend tests in watch mode
pnpm --filter @devopslocal/desktop test:watch

# TypeScript type check + lint
pnpm --filter @devopslocal/desktop lint

# Rust unit tests
cargo test --workspace

# Rust lints
cargo clippy --workspace -- -D warnings

# Rust security audit
cargo audit
```

---

## Project Structure

```
devopslocal/
├── packages/
│   └── desktop/            # Tauri app entry point
│       └── src-tauri/      # Tauri config, capabilities, icons
├── crates/
│   ├── tauri-shell/        # Tauri commands (IPC layer)
│   ├── db/                 # SQLx: env var CRUD, settings, migrations
│   └── docker-ops/         # bollard: containers, stats, logs, events, networks
├── src/                    # React frontend (symlinked into packages/desktop)
│   ├── pages/              # Dashboard, Environments, Logs, Network, Settings, Volumes
│   ├── components/         # Shared UI components + ErrorBoundary
│   ├── hooks/              # TanStack Query hooks
│   ├── lib/
│   │   └── ipc.ts          # Typed Tauri IPC wrappers
│   └── styles/             # CSS design tokens
└── .github/
    └── workflows/ci.yml    # Lint → test → audit → build pipeline
```

---

## Architecture

```
React UI  ──invoke──▶  Tauri Commands  ──▶  Rust Modules  ──▶  OS / Docker Socket
          ◀──events──                   ◀──
```

- **IPC** — `src/lib/ipc.ts` provides fully-typed wrappers over `@tauri-apps/api/core` `invoke`. Events (log lines, Docker events) use `@tauri-apps/api/event` `listen`.
- **Storage** — SQLite at `$APP_DATA_DIR/devopslocal.db`. Schema managed by SQLx migrations.
- **No Electron** — Tauri produces a ~10 MB binary vs ~150 MB for Electron.

---

## Security

- Sensitive env var values (keys matching `secret`, `password`, `token`, etc.) are stored in the OS keychain, not in SQLite.
- The auto-updater verifies update signatures — set `plugins.updater.pubkey` in `tauri.conf.json` before shipping (run `tauri signer generate`).
- All SQL queries use parameterized binds (no injection risk).
- Env var keys are validated server-side: alphanumeric + underscore, must start with a letter or underscore.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). All PRs must pass CI before merge.

Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

---

## License

[MIT](LICENSE)
