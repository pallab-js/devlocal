# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-05-07

### Added

- Container search / filter with debounced input
- Image pull progress UI with per-layer progress bars
- Log export (copy to clipboard + save file dialog)
- Volume inspect modal with full detail view
- Theme toggle (light/dark) in top bar
- Keyboard shortcuts (Cmd+1-5 for navigation, ? for guide)
- Structured IPC error types with `code` field for frontend classification

### Fixed

- `import_secrets` Kubernetes branch now routes sensitive values through OS keychain
- `compose_up` / `compose_down` validate `config_dir` is an absolute existing directory
- Poll intervals now initialized from DB at startup (not just localStorage)
- Settings page persists poll intervals to DB via `ipc.setSetting`

### Changed

- `require_docker()` helper eliminates 18 duplicate Docker guard blocks
- `map_network_containers()` helper deduplicates network container mapping
- `get_host_stats` caches disk data for 10 seconds (DiskState)
- `AppError` serializes as structured `{ code, message }` instead of flat string
- Tauri capabilities tightened: `dialog:default` → `dialog:allow-open` + `dialog:allow-save`, `fs:default` → `fs:allow-write-text-file`

### Removed

- Dead `containerSlice.ts` (unused Zustand store)
- Root `src/` legacy copy replaced with symlink to `packages/desktop/src`
- `cargo audit` CLI flags moved to `audit.toml`

## [0.1.0] - 2026-04-XX

### Added

- Initial release
- Docker container lifecycle management (start, stop, restart)
- Container stats monitoring (CPU, memory)
- Host resource monitoring (CPU, RAM, disk)
- Environment variable management with OS keychain for secrets
- Docker Compose project support
- Image management (list, pull, remove)
- Volume management (list, prune)
- Network topology visualization
- Real-time log streaming with virtual scrolling
- Docker event stream
- Settings page with polling interval configuration
- Tauri updater integration
