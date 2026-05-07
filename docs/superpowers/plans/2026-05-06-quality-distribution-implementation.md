# Quality, CI/CD & Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden project quality, automate CI checks, implement internationalization, and streamline releases.

**Architecture:** Monorepo-aware CI/CD, mocked Rust integration tests, i18n framework, and automated changelogs.

**Tech Stack:** GitHub Actions, Rust (wiremock, proptest), React (react-i18next).

---

## Task 1: CI Pipeline Monorepo Adaptation

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Update Workflow Paths**
Update `Swatinem/rust-cache` to include all crates and update `working-directory` references to point to the correct workspace members.

- [ ] **Step 2: Add Security Audits**
Add `cargo-audit` for Rust and `pnpm audit` for Node.js dependencies.

- [ ] **Step 3: Configure Coverage**
Update `vitest` to generate coverage and upload the results.

- [ ] **Step 4: Commit**
```bash
git add .github/workflows/ci.yml
git commit -m "ci: adapt workflow for monorepo and add security audits"
```

---

## Task 2: Rust Integration Testing (Mocked)

**Files:**
- Modify: `crates/docker-ops/Cargo.toml`
- Create: `crates/docker-ops/tests/docker_mock.rs`

- [ ] **Step 1: Add Test Dependencies**
Add `wiremock` and `tokio-test` to `dev-dependencies`.

- [ ] **Step 2: Implement Mock Server**
Write a test that starts a `wiremock` server, mocks the Docker `/containers/json` endpoint, and verifies that `docker_ops::list_containers` parses the response correctly.

- [ ] **Step 3: Verify**
Run: `cargo test -p docker-ops --test docker_mock`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add crates/docker-ops
git commit -m "test: add mocked docker integration tests"
```

---

## Task 3: Rust Property-Based Testing

**Files:**
- Modify: `crates/db/Cargo.toml`
- Modify: `crates/db/src/lib.rs`

- [ ] **Step 1: Add `proptest`**
Add `proptest` and `proptest-derive` to `dev-dependencies`.

- [ ] **Step 2: Implement Property Tests**
Add a `proptest!` block to verify that `EnvVar` structs can be round-tripped through JSON serialization/deserialization without data loss.

- [ ] **Step 3: Verify**
Run: `cargo test -p db`
Expected: PASS (with 1000+ generated cases)

- [ ] **Step 4: Commit**
```bash
git add crates/db
git commit -m "test: add property-based testing for DB types"
```

---

## Task 4: Internationalization (i18n) Setup

**Files:**
- Modify: `packages/desktop/package.json`
- Create: `packages/desktop/src/i18n.ts`
- Create: `packages/desktop/src/locales/en.json`
- Modify: `packages/desktop/src/main.tsx`

- [ ] **Step 1: Install i18n Libraries**
`cd packages/desktop && pnpm add i18next react-i18next i18next-browser-languagedetector`

- [ ] **Step 2: Initialize i18n**
Configure the instance in `src/i18n.ts` and import it in `main.tsx`.

- [ ] **Step 3: Create Translation File**
Add base English strings for the Dashboard and Settings.

- [ ] **Step 4: Commit**
```bash
git add packages/desktop
git commit -m "feat: setup internationalization framework"
```

---

## Task 5: Release Automation

**Files:**
- Create: `.github/workflows/release-drafter.yml`
- Create: `.github/release-drafter.yml`

- [ ] **Step 1: Setup Release Drafter**
Create the workflow and configuration files to categorize PRs by labels (`feat`, `fix`, `chore`).

- [ ] **Step 2: Commit**
```bash
git add .github
git commit -m "ci: add release-drafter for automated changelogs"
```
