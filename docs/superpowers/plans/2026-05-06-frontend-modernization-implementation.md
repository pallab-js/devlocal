# Frontend Modernization & UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize styling, add theme support, and optimize performance.

**Architecture:** Tailwind CSS v4 migration, CSS-variable-based theme toggle, and virtual scrolling for large lists.

**Tech Stack:** React 19, Tailwind v4, @tanstack/react-virtual.

---

## Task 1: CSS Variables & Theme Configuration

**Files:**
- Modify: `packages/desktop/src/styles/tokens.css`

- [ ] **Step 1: Refactor `tokens.css` for Theme Support**
Define `:root` (Light) and `.dark` palettes. Ensure all variables used in current inline styles are represented.

```css
@import "tailwindcss";

@theme {
  --color-bg: var(--bg);
  --color-bg-deep: var(--bg-deep);
  --color-surface: var(--surface);
  --color-surface-hi: var(--surface-hi);
  --color-surface-2: var(--surface-2);
  --color-surface-3: var(--surface-3);
  --color-border: var(--border);
  --color-border-hi: var(--border-hi);
  --color-border-light: var(--border-light);
  --color-green: var(--green);
  --color-text: var(--text);
  --color-text-2: var(--text-2);
  --color-text-3: var(--text-3);
  --color-orange: var(--orange);
  --color-violet: var(--violet);
  --color-error: var(--error);
}

/* Light Theme (Default) */
:root {
  --bg: #ffffff;
  --bg-deep: #f3f4f6;
  --surface: #ffffff;
  --surface-hi: #f9fafb;
  --surface-2: #f3f4f6;
  --surface-3: #e5e7eb;
  --border: #e5e7eb;
  --border-hi: #d1d5db;
  --border-light: #f3f4f6;
  --green: #10b981;
  --text: #111827;
  --text-2: #4b5563;
  --text-3: #9ca3af;
  --orange: #f97316;
  --violet: #8b5cf6;
  --error: #ef4444;
}

/* Dark Theme */
.dark {
  --bg: #171717;
  --bg-deep: #0f0f0f;
  --surface: #131313;
  --surface-hi: #1c1c1c;
  --surface-2: #202020;
  --surface-3: #2a2a2a;
  --border: #2e2e2e;
  --border-hi: #363636;
  --border-light: #242424;
  --green: #3ecf8e;
  --text: #fafafa;
  --text-2: #b4b4b4;
  --text-3: #898989;
  --orange: #ffa072;
  --violet: hsl(251, 63.2%, 63.2%);
  --error: #ffb4ab;
}
```

- [ ] **Step 2: Commit**
```bash
git add packages/desktop/src/styles/tokens.css
git commit -m "style: configure CSS variables for theme support"
```

---

## Task 2: Theme Toggle Hook & UI

**Files:**
- Create: `packages/desktop/src/hooks/useTheme.ts`
- Modify: `packages/desktop/src/components/layout/TopBar.tsx`

- [ ] **Step 1: Create `useTheme` hook**
Implement logic to persist theme in `localStorage` and toggle the `dark` class on the `documentElement`.

- [ ] **Step 2: Add Toggle to `TopBar`**
Add a button with sun/moon icons to switch between themes.

- [ ] **Step 3: Verify**
Toggle theme and ensure colors swap correctly.

- [ ] **Step 4: Commit**
```bash
git add packages/desktop/src/hooks/useTheme.ts packages/desktop/src/components/layout/TopBar.tsx
git commit -m "feat: add light/dark theme toggle"
```

---

## Task 3: Tailwind Migration (Layout & Global Components)

**Files:**
- Modify: `packages/desktop/src/components/layout/AppShell.tsx`
- Modify: `packages/desktop/src/components/layout/SideNav.tsx`
- Modify: `packages/desktop/src/components/Skeleton.tsx`
- Modify: `packages/desktop/src/components/Toast.tsx`

- [ ] **Step 1: Refactor AppShell**
Replace `style={{ display: "flex", ... }}` with `className="flex flex-col h-screen overflow-hidden"`.

- [ ] **Step 2: Refactor SideNav**
Move `style` objects to Tailwind classes. Use `data-active` or similar for active states instead of dynamic style objects if possible, or use standard Tailwind `hover:` and `[&.active]:` classes.

- [ ] **Step 3: Refactor Skeleton & Toast**
Ensure `Skeleton` uses `bg-surface-2` utility.

- [ ] **Step 4: Commit**
```bash
git add packages/desktop/src/components
git commit -m "refactor: migrate layout components to Tailwind classes"
```

---

## Task 4: Tailwind Migration (Dashboard & Modals)

**Files:**
- Modify: `packages/desktop/src/pages/Dashboard.tsx`
- Modify: `packages/desktop/src/components/ContainerDetailsModal.tsx`

- [ ] **Step 1: Refactor Dashboard**
Convert the grid layouts, cards, and table styles to Tailwind.

- [ ] **Step 2: Refactor ContainerDetailsModal**
Convert fixed positioning and resource usage bars to Tailwind.

- [ ] **Step 3: Commit**
```bash
git add packages/desktop/src/pages/Dashboard.tsx packages/desktop/src/components/ContainerDetailsModal.tsx
git commit -m "refactor: migrate dashboard and modals to Tailwind"
```

---

## Task 5: Container List Virtualization

**Files:**
- Modify: `packages/desktop/src/pages/Dashboard.tsx`

- [x] **Step 1: Implement `useVirtualizer`**
Wrap the container table body in a virtualizer to handle large lists.

- [x] **Step 2: Verify**
Mock 100+ containers and ensure smooth scrolling.

- [x] **Step 3: Commit**
```bash
git add packages/desktop/src/pages/Dashboard.tsx
git commit -m "perf: virtualize container list"
```

---

## Task 6: Log Virtualization & Export

**Files:**
- Modify: `packages/desktop/src/pages/Logs.tsx`

- [ ] **Step 1: Upgrade Logs to `useVirtualizer`**
Replace the simple array slicing with a full virtual scroll implementation.

- [ ] **Step 2: Add Log Export**
Add a button to save the current filtered log view to a file via Tauri's `save` dialog.

- [ ] **Step 3: Commit**
```bash
git add packages/desktop/src/pages/Logs.tsx
git commit -m "perf: virtualize logs and add export feature"
```

---

## Task 7: Debounced Search & Keyboard Shortcuts

**Files:**
- Create: `packages/desktop/src/hooks/useDebounce.ts`
- Modify: `packages/desktop/src/pages/Dashboard.tsx`, `packages/desktop/src/pages/Logs.tsx`, `packages/desktop/src/pages/Environments.tsx`
- Modify: `packages/desktop/src/App.tsx` (shortcuts modal)

- [ ] **Step 1: Implement `useDebounce`**
Create a generic 300ms debounce hook.

- [ ] **Step 2: Apply to Search Inputs**
Update filtering logic to use the debounced value.

- [ ] **Step 3: Add Shortcuts Modal**
Implement a modal triggered by `?` listing available keyboard shortcuts.

- [ ] **Step 4: Commit**
```bash
git add packages/desktop/src
git commit -m "ux: add debounced search and shortcuts guide"
```
