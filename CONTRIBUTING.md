# Contributing to DevOpsLocal

## Setup

```bash
pnpm install && pnpm tauri dev
```

## Branch Naming

`feat/*`, `fix/*`, `docs/*`, `chore/*`

## Commit Style

[Conventional Commits](https://www.conventionalcommits.org/): `feat: add log filter`, `fix: docker socket timeout`

## PR Rules

- PRs must pass CI (lint + test + cargo check)
- All UI must use design token CSS variables — no hardcoded hex values
- No new dependencies without discussion in an issue first

## Issue Labels

`good-first-issue` · `help-wanted` · `rust-core` · `ui-frontend` · `bug` · `enhancement`
