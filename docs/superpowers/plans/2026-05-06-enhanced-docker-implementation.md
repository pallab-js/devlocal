# Enhanced Docker Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement real-time health monitoring, image management, resource limit editing, and Compose lifecycle actions.

**Architecture:** Rust-based polling loop for health, new Image management module in `docker-ops`, and frontend UI for the new features.

**Tech Stack:** Rust (bollard), Tauri Events, React 19.

---

## Task 1: Docker Connection Health Monitor (Backend)

**Files:**
- Modify: `crates/tauri-shell/src/docker.rs`
- Modify: `crates/tauri-shell/src/lib.rs`

- [ ] **Step 1: Implement `start_health_monitor`**
Add a function in `crates/tauri-shell/src/docker.rs` that polls `docker.ping()` every 5 seconds and emits `app:dockerd-status` events.

- [ ] **Step 2: Spawn monitor on setup**
In `crates/tauri-shell/src/lib.rs`, call `start_health_monitor` within the `.setup()` hook.

- [ ] **Step 3: Commit**
```bash
git add crates/tauri-shell
git commit -m "feat: add backend docker health monitor"
```

---

## Task 2: Health Monitor Banner (Frontend)

**Files:**
- Modify: `packages/desktop/src/App.tsx`

- [x] **Step 1: Listen for health events**
Use `@tauri-apps/api/event` to listen for `app:dockerd-status`.

- [x] **Step 2: Render Banner**
Display a persistent banner at the top of the app when Docker is offline.

- [x] **Step 3: Commit**
```bash
git add packages/desktop/src/App.tsx
git commit -m "feat: add global docker health banner"
```

---

## Task 3: Image Management (Backend)

**Files:**
- Modify: `crates/docker-ops/src/lib.rs`
- Modify: `crates/tauri-shell/src/docker.rs`

- [ ] **Step 1: Add image methods to `docker-ops`**
Implement `list_images`, `remove_image`, and `pull_image`.

- [ ] **Step 2: Expose Tauri commands**
Register `list_images`, `remove_image`, and `pull_image` in `tauri-shell`.

- [ ] **Step 3: Commit**
```bash
git add crates/docker-ops crates/tauri-shell
git commit -m "feat: implement image management backend"
```

---

## Task 4: Image Management Page (Frontend)

**Files:**
- Create: `packages/desktop/src/pages/Images.tsx`
- Modify: `packages/desktop/src/App.tsx` (routing)

- [ ] **Step 1: Create Images page**
Implement image list with virtualization.

- [ ] **Step 2: Implement Pull Modal**
Add a modal to pull images with a progress bar.

- [ ] **Step 3: Commit**
```bash
git add packages/desktop/src
git commit -m "feat: add image management page and pull modal"
```

---

## Task 5: Container Resource Limits Editor

**Files:**
- Modify: `crates/docker-ops/src/lib.rs`
- Modify: `crates/tauri-shell/src/docker.rs`
- Modify: `packages/desktop/src/components/ContainerDetailsModal.tsx`

- [ ] **Step 1: Add update command to backend**
Implement `update_container_limits` in `docker-ops`.

- [ ] **Step 2: Add UI to modal**
Add "Edit Limits" inputs to `ContainerDetailsModal`.

- [ ] **Step 3: Commit**
```bash
git add crates/ packages/desktop
git commit -m "feat: add container resource limits editor"
```

---

## Task 6: Basic Compose Integration

**Files:**
- Modify: `crates/docker-ops/src/lib.rs`
- Modify: `crates/tauri-shell/src/docker.rs`
- Modify: `packages/desktop/src/pages/Dashboard.tsx`

- [ ] **Step 1: Add Compose commands to backend**
Implement `compose_up` and `compose_down` using `std::process::Command`.

- [ ] **Step 2: Add UI to Dashboard**
Add "Start All" and "Stop All" buttons to compose groups.

- [ ] **Step 3: Commit**
```bash
git add crates/ packages/desktop
git commit -m "feat: add basic docker compose integration"
```
