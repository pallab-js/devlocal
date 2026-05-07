# Sub-project 5: Quality, CI/CD & Distribution Design

**Goal:** Harden the application's quality through advanced testing, automate security and bundle size checks in CI, enable internationalization, and streamline the release process.

**Architecture:** GitHub Actions for CI/CD, `proptest` and `wiremock` for Rust testing, `react-i18next` for frontend translations, and Release Drafter for changelogs.

**Tech Stack:** GitHub Actions, Rust (proptest, wiremock), React (react-i18next).

---

## 1. CI Pipeline Enhancements

### Monorepo Adaptation & Audits
Update the existing CI workflow to support the new workspace structure and add security checks.

*   **`.github/workflows/ci.yml`**:
    *   Change `working-directory: src-tauri` to root or appropriate workspace members.
    *   Add step: `cargo install cargo-audit && cargo audit`.
    *   Add step: `pnpm audit`.
    *   Add step: `pnpm test --coverage` (requires updating `vitest.config.ts` if it exists, or package.json scripts).

### Bundle Size Tracking
*   **`.github/workflows/ci.yml`**: Add a step using a community action (e.g., `andresz1/size-limit-action`) to track frontend bundle size changes on PRs.

## 2. Rust Testing

### Integration Tests (Mocked Docker)
Ensure robust testing without requiring a live Docker daemon in CI.

*   **`crates/docker-ops/Cargo.toml`**: Add `wiremock` and `tokio-test` as `dev-dependencies`.
*   **`crates/docker-ops/tests/docker_mock.rs`**: Create a mock server using `wiremock`. Instantiate a `bollard::Docker` client pointing to the mock server's URI. Test `list_containers` and `inspect_container` by returning predefined JSON responses.

### Property-Based Testing
Ensure serialization roundtrips handle edge cases.

*   **`crates/db/Cargo.toml`**: Add `proptest` as a `dev-dependency`.
*   **`crates/db/src/lib.rs`**: Add a test module using `proptest!` to generate random `EnvVar` structs (random strings, scopes) and verify they serialize and deserialize without loss.

## 3. Internationalization (i18n)

### Framework Setup
*   **`packages/desktop/package.json`**: Add `i18next` and `react-i18next`.
*   **`packages/desktop/src/i18n.ts`**: Initialize the i18n instance.
*   **`packages/desktop/src/locales/en.json`**: Create the base English translation file.

### UI Integration
*   **`packages/desktop/src/main.tsx`**: Import `i18n.ts`.
*   **`packages/desktop/src/pages/Settings.tsx`**: Add a language selector dropdown. Save the preference to `localStorage`. Use the `useTranslation` hook for text in this component as a proof-of-concept.

## 4. Distribution & Release Automation

### Release Drafter
Automate changelog generation.

*   **`.github/workflows/release-drafter.yml`**: Create a workflow triggered on push to main that uses `release-drafter/release-drafter@v5`.
*   **`.github/release-drafter.yml`**: Configure the template to categorize PRs based on labels (`feat`, `fix`, `chore`).

### Auto-Updater Configuration
*   **`packages/desktop/src-tauri/tauri.conf.json`**: Ensure the `updater` plugin block has a placeholder `pubkey` field ready for the actual key deployment.
