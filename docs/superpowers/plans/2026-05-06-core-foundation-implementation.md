# DevOpsLocal Foundation & Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate to a monorepo, restructure Rust code into modular crates, and implement structured error handling/type generation.

**Architecture:** pnpm workspaces for frontend/shared, Cargo workspaces for Rust crates. Modular design separating Docker ops, DB, and Tauri shell.

**Tech Stack:** pnpm, Cargo, Tauri, thiserror, ts-rs.

---

## Task 1: Initialize pnpm Workspace

**Files:**
- Create: `pnpm-workspace.yaml`
- Modify: `package.json` (root)

- [ ] **Step 1: Create `pnpm-workspace.yaml`**
```yaml
packages:
  - "packages/*"
```

- [ ] **Step 2: Prepare root `package.json`**
Remove all `dependencies` and `devDependencies` from the root `package.json` that are React-specific. Keep only the basic metadata and monorepo-wide scripts if any.

- [ ] **Step 3: Commit**
```bash
git add pnpm-workspace.yaml package.json
git commit -m "chore: initialize pnpm workspace"
```

---

## Task 2: Move React App to `packages/desktop`

**Files:**
- Create: `packages/desktop/package.json`
- Modify: Move `src/`, `public/`, `vite.config.ts`, `tsconfig.json`, `index.html` to `packages/desktop/`

- [ ] **Step 1: Create `packages/desktop` directory**
```bash
mkdir -p packages/desktop
```

- [ ] **Step 2: Move frontend files**
Move `src/`, `public/`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `.prettierrc`, `eslint.config.js` to `packages/desktop/`.
Move `src-tauri` to `packages/desktop/src-tauri`.

- [ ] **Step 3: Update `packages/desktop/package.json`**
Ensure paths in `packages/desktop/package.json` are correct (e.g., `tauri` commands might need adjustment if they were relative to root).

- [ ] **Step 4: Verify frontend builds**
Run: `cd packages/desktop && pnpm install && pnpm build`
Expected: Successful Vite build.

- [ ] **Step 5: Commit**
```bash
git add packages/desktop
git commit -m "refactor: move desktop app to packages/desktop"
```

---

## Task 3: Initialize Cargo Workspace

**Files:**
- Create: `Cargo.toml` (root)

- [ ] **Step 1: Create root `Cargo.toml`**
```toml
[workspace]
members = [
    "packages/desktop/src-tauri",
    "crates/docker-ops",
    "crates/db",
    "crates/tauri-shell",
]
resolver = "2"
```

- [ ] **Step 2: Create crate directories**
```bash
mkdir -p crates/docker-ops/src crates/db/src crates/tauri-shell/src
```

- [ ] **Step 3: Commit**
```bash
git add Cargo.toml crates/
git commit -m "chore: initialize cargo workspace"
```

---

## Task 4: Extract `docker-ops` Crate

**Files:**
- Create: `crates/docker-ops/Cargo.toml`
- Create: `crates/docker-ops/src/lib.rs`
- Modify: `packages/desktop/src-tauri/src/docker/mod.rs` (move content)

- [ ] **Step 1: Define `docker-ops/Cargo.toml`**
Copy relevant dependencies from `src-tauri/Cargo.toml` (bollard, tokio, serde, futures-util).

- [ ] **Step 2: Move Docker logic**
Move contents of `packages/desktop/src-tauri/src/docker/` to `crates/docker-ops/src/`. Refactor to be a library crate.

- [ ] **Step 3: Verify crate builds**
Run: `cargo build -p docker-ops`
Expected: Successful build.

- [ ] **Step 4: Commit**
```bash
git add crates/docker-ops
git commit -m "refactor: extract docker-ops crate"
```

---

## Task 5: Extract `db` Crate

**Files:**
- Create: `crates/db/Cargo.toml`
- Create: `crates/db/src/lib.rs`
- Modify: `packages/desktop/src-tauri/src/db/mod.rs` (move content)

- [ ] **Step 1: Define `db/Cargo.toml`**
Copy relevant dependencies (sqlx, serde, tokio).

- [ ] **Step 2: Move DB logic**
Move contents of `packages/desktop/src-tauri/src/db/` to `crates/db/src/`. Ensure migrations path is handled correctly (relative to the crate or absolute).

- [ ] **Step 3: Verify crate builds**
Run: `cargo build -p db`
Expected: Successful build.

- [ ] **Step 4: Commit**
```bash
git add crates/db
git commit -m "refactor: extract db crate"
```

---

## Task 6: Implement Structured Error Handling

**Files:**
- Create: `crates/tauri-shell/src/error.rs`
- Create: `crates/tauri-shell/Cargo.toml`
- Modify: `crates/tauri-shell/src/lib.rs`

- [ ] **Step 1: Define `AppError` enum**
In `crates/tauri-shell/src/error.rs`:
```rust
use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Docker error: {0}")]
    Docker(#[from] bollard::errors::Error),
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("{0}")]
    Generic(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
```

- [ ] **Step 2: Refactor Tauri commands to use `Result<T>`**
Update commands in `src-tauri/src/lib.rs` (to be moved to `tauri-shell`) to return `Result<T>`.

- [ ] **Step 3: Commit**
```bash
git add crates/tauri-shell
git commit -m "feat: implement structured error handling"
```

---

## Task 7: Setup `ts-rs` for Type Generation

**Files:**
- Modify: `crates/docker-ops/Cargo.toml`, `crates/db/Cargo.toml`
- Create: `packages/shared/package.json`
- Create: `packages/shared/index.d.ts` (generated)

- [ ] **Step 1: Add `ts-rs` to crates**
Add `ts-rs = { version = "10", features = ["serde-compat"] }` to `Cargo.toml` of relevant crates.

- [ ] **Step 2: Annotate structs**
Add `#[derive(TS)]` and `#[ts(export, export_to = "../../packages/shared/types/")]` to structs like `ContainerInfo`, `EnvVar`.

- [ ] **Step 3: Create export test**
Add a test in `crates/tauri-shell` that triggers type generation.

- [ ] **Step 4: Run generation**
Run: `cargo test export_bindings`
Expected: `packages/shared/types/` populated with `.ts` files.

- [ ] **Step 5: Commit**
```bash
git add crates/ packages/shared
git commit -m "feat: setup ts-rs type generation"
```

---

## Task 8: Security Hardening

**Files:**
- Modify: `packages/desktop/src-tauri/tauri.conf.json`
- Modify: `packages/desktop/src-tauri/capabilities/default.json`

- [ ] **Step 1: Tighten CSP**
Remove `'unsafe-inline'` from `tauri.conf.json`.

- [ ] **Step 2: Restrict Permissions**
Review and minimize `capabilities/default.json`.

- [ ] **Step 3: Commit**
```bash
git add packages/desktop/src-tauri
git commit -m "security: tighten CSP and permissions"
```
