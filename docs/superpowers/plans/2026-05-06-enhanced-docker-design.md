# Sub-project 3: Enhanced Docker Features Design

**Goal:** Expand the application's Docker capabilities with a daemon health monitor, image management, dynamic resource limits, and basic Compose integration.

**Architecture:** Rust background tasks for health monitoring emitting Tauri events. New `docker-ops` methods for image lifecycle and container updates. Frontend additions for the Images page and modal enhancements.

**Tech Stack:** Rust (bollard, std::process::Command), Tauri Events, React 19.

---

## 1. Docker Connection Health Monitor

### Rust Background Task
Create a continuous polling loop to check Docker daemon status.

*   **`crates/tauri-shell/src/docker.rs`**: Add a `start_health_monitor` function.
    *   It takes an `Arc<bollard::Docker>` and a `tauri::AppHandle`.
    *   Runs a loop doing `docker.ping().await` every 5 seconds.
    *   Maintains the last known state. If the state changes, it emits an `app:dockerd-status` event with payload `{ "online": true/false }`.
*   **`crates/tauri-shell/src/lib.rs`**: Spawn this monitor during application `setup`.

### Frontend Banner
Display a global warning when Docker is down.

*   **`packages/desktop/src/App.tsx`**: Add an event listener for `app:dockerd-status`.
*   Render a persistent `bg-error-dim text-error` banner at the top of the AppShell when `online` is false.

## 2. Image Management Page

### Backend API
Expand `docker-ops` to handle images.

*   **`crates/docker-ops/src/lib.rs`**:
    *   `list_images`: Returns a `Vec<ImageInfo>`.
    *   `remove_image(id, force)`: Calls `docker.remove_image`.
    *   `pull_image(image_tag)`: Uses `docker.create_image` stream. Emits `app:image-pull-progress` events to the frontend.
*   **`crates/tauri-shell/src/docker.rs`**: Expose these as Tauri commands.
*   **`packages/shared/`**: Ensure `ImageInfo` is generated via `ts-rs`.

### Frontend UI
Create a new page for images.

*   **`packages/desktop/src/pages/Images.tsx`**: Add a virtualized table showing images, tags, size, and created date. Add a "Remove" button per row.
*   **Pull Modal**: Add a "Pull Image" button that opens a modal, accepts a tag, calls `pull_image`, and listens for progress events to update a progress bar.

## 3. Container Resource Limits Editor

### Backend API
*   **`crates/docker-ops/src/lib.rs`**: Add `update_container_limits(id, cpu_shares, memory_bytes)`. Uses `bollard`'s `update_container`.

### Frontend UI
*   **`packages/desktop/src/components/ContainerDetailsModal.tsx`**: Add an "Edit" button next to "Resource Usage". Upon clicking, show inputs for CPU Shares and Memory Limit. Submit calls the new API and refreshes the container details.

## 4. Basic Compose Integration

### Backend API
Shell out to Docker Compose.

*   **`crates/docker-ops/src/lib.rs`**: Add `compose_up(project_name, config_dir)` and `compose_down(project_name, config_dir)` using `std::process::Command` targeting `docker compose`.
*   *Note:* Figuring out the `config_dir` purely from existing running containers' labels (`com.docker.compose.project.working_dir`) will be necessary.

### Frontend UI
*   **`packages/desktop/src/pages/Dashboard.tsx`**: In the Compose grouped view, add "Start All" and "Stop All" buttons to the group header, utilizing the new commands.
