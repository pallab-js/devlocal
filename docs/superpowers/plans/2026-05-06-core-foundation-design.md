# Sub-project 1: Core Foundation & Security Design

**Goal:** Establish a scalable monorepo structure, modularize the Rust backend, and implement robust error handling and type generation.

**Architecture:** Migrate from a single React+Tauri project to a pnpm workspace with separated Rust crates. Utilize `thiserror` for structured backend errors and `ts-rs` for frontend/backend type synchronization.

**Tech Stack:** pnpm, Cargo workspaces, Tauri, thiserror, ts-rs.

---

## 1. Workspace Layout

### pnpm Workspace
Convert the root into a pnpm workspace.

*   **Root `pnpm-workspace.yaml`:**
    ```yaml
    packages:
      - 'packages/*'
    ```
*   **Move React App:** Move existing React source, `package.json`, `vite.config.ts`, etc., into `packages/desktop/`.
*   **Shared Types Package:** Create `packages/shared/` to host generated TypeScript definitions. Include a minimal `package.json` for it.

### Cargo Workspace
Create a root Cargo workspace to manage the split crates.

*   **Root `Cargo.toml`:**
    ```toml
    [workspace]
    members = [
        "packages/desktop/src-tauri",
        "crates/docker-ops",
        "crates/db",
        "crates/tauri-shell"
    ]
    resolver = "2"
    ```

## 2. Rust Crate Extraction

Extract logic from the existing monolithic `src-tauri` into independent crates within `crates/`.

*   `crates/docker-ops`: Isolate `bollard` related logic.
*   `crates/db`: Isolate `sqlx` related logic.
*   `crates/tauri-shell`: Isolate Tauri commands, IPC glue, and application state.
*   Update `packages/desktop/src-tauri/Cargo.toml` to depend on these new local crates instead of directly including the logic.

## 3. Error Handling (`thiserror`)

Replace ad-hoc string-based errors with a structured `AppError` enum.

*   **`crates/tauri-shell/src/error.rs` (or shared error crate):**
    ```rust
    use serde::Serialize;
    use thiserror::Error;

    #[derive(Debug, Error)]
    pub enum AppError {
        #[error("Docker error: {0}")]
        Docker(#[from] bollard::errors::Error),
        
        #[error("Database error: {0}")]
        Database(#[from] sqlx::Error),
        
        #[error("Operation failed: {context} ({source})")]
        Context { context: String, source: String },
    }

    impl Serialize for AppError {
        fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
        where
            S: serde::Serializer,
        {
            serializer.serialize_str(&self.to_string())
        }
    }

    pub type Result<T> = std::result::Result<T, AppError>;
    ```
*   Refactor extracted crates (`docker-ops`, `db`) to use `Result<T>` with `AppError` (or their own specific error enums that map to `AppError`).

## 4. Type Synchronization (`ts-rs`)

Automate the generation of TypeScript types from Rust structs.

*   Add `ts-rs` to dependencies.
*   Annotate relevant structs (e.g., `ContainerInfo`, `EnvVar`) with `#[derive(TS)]` and `#[ts(export)]`.
*   Configure `ts-rs` to output bindings into `packages/shared/index.d.ts`.
*   Update frontend imports in `packages/desktop` to use the generated types from the `shared` workspace package.

## 5. Security Hardening (from Blueprint Section 2)

*   **CSP Tightening:** Update `packages/desktop/src-tauri/tauri.conf.json` to remove `'unsafe-inline'` for `style-src`. Move inline styles to CSS modules or Tailwind.
*   **Permission Scoping:** Review `packages/desktop/src-tauri/capabilities/default.json` and restrict permissions to the minimum required.
*   **Keyring Hardening:** Update `db` crate to use randomized sentinels.
*   **Docker Socket Validation:** Add path validation in `tauri-shell` or `docker-ops`.
