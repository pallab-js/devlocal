# Task 4: Image Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement image management including listing images and a pull modal.

**Architecture:** Extend IPC layer for images, add React Query hooks, create Images page with virtualized list, and integrate into navigation.

**Tech Stack:** React, Tauri, TanStack Query, Lucide React (icons), Tailwind CSS.

---

### Task 1: IPC Definitions

**Files:**
- Modify: `packages/desktop/src/lib/ipc.ts`

- [ ] **Step 1: Define ImageInfo and image commands**
Add `ImageInfo` interface and update `TauriCommands` with `get_images`, `pull_image`, `delete_image`, `prune_images`.

### Task 2: React Query Hooks

**Files:**
- Modify: `packages/desktop/src/hooks/useQueries.ts`

- [ ] **Step 1: Add useImages and useImageMutations**
Implement hooks for fetching and mutating images.

### Task 3: Images Page and Pull Modal

**Files:**
- Create: `packages/desktop/src/pages/Images.tsx`

- [ ] **Step 1: Implement Images page**
Create the page with virtualized list and pull modal using `app:image-pull-progress` event.

### Task 4: Navigation and Routing

**Files:**
- Modify: `packages/desktop/src/App.tsx`
- Modify: `packages/desktop/src/components/layout/SideNav.tsx`

- [ ] **Step 1: Register /images route**
Add route to `App.tsx`.

- [ ] **Step 2: Add to SideNav**
Add images link to `SideNav.tsx`.

### Task 5: Verification and Commit

- [ ] **Step 1: Verify build**
Run `npm run build` or equivalent.

- [ ] **Step 2: Commit changes**
```bash
git add packages/desktop/src
git commit -m "feat: add image management page and pull modal"
```
