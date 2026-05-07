# Sub-project 2: Frontend Modernization & UX Design

**Goal:** Modernize the frontend by migrating to Tailwind v4, implementing a light/dark theme toggle, and improving performance with virtualization and debouncing.

**Architecture:** React 19 frontend utilizing Tailwind v4 for styling. Theme state managed via a custom hook and CSS variables (`data-theme`). Performance optimization using `@tanstack/react-virtual`.

**Tech Stack:** React, Tailwind CSS v4, @tanstack/react-virtual, Zustand (optional for theme state).

---

## 1. Tailwind Migration & Theme Token Alignment

### Refactor CSS Variables
Ensure `packages/desktop/src/styles/tokens.css` exposes variables to Tailwind v4.

*   **`tokens.css`:**
    ```css
    @import "tailwindcss";

    @theme {
      --color-bg: var(--bg);
      --color-bg-deep: var(--bg-deep);
      --color-surface: var(--surface);
      /* ... map all variables ... */
    }

    /* Light Theme (Default) */
    :root {
      --bg: #ffffff;
      --bg-deep: #f3f4f6;
      --surface: #ffffff;
      /* ... define light colors ... */
    }

    /* Dark Theme */
    .dark {
      --bg: #171717;
      --bg-deep: #0f0f0f;
      --surface: #131313;
      /* ... define dark colors ... */
    }
    ```

### Refactor Inline Styles
Systematically replace `style={{...}}` with Tailwind utility classes across components:
*   `src/components/layout/AppShell.tsx`
*   `src/components/layout/SideNav.tsx`
*   `src/components/layout/TopBar.tsx`
*   `src/components/ContainerDetailsModal.tsx`
*   `src/pages/Dashboard.tsx`

## 2. Dark / Light Theme Toggle

Implement a user-toggled theme manager.

*   **`useTheme.ts` hook:** Create a hook that reads from `localStorage`, defaults to system preference, and toggles the `.dark` class on the `<html>` or `<body>` element.
*   **`TopBar.tsx`:** Add a ThemeToggle button (sun/moon icon) that calls the hook.

## 3. Virtualization (Performance)

Improve rendering performance for large lists.

*   **`Dashboard.tsx`:** Implement `useVirtualizer` from `@tanstack/react-virtual` for the container list table rows.
*   **`Logs.tsx`:** Enhance the existing log viewing logic by implementing true virtual scrolling for the log lines array.

## 4. Debounced Search & UX Polish

Prevent UI stuttering during fast typing.

*   **`useDebounce.ts` hook:** Create a standard debounce hook (e.g., 300ms).
*   **Search Inputs:** Apply the debounce hook to the search states in `Dashboard.tsx`, `Logs.tsx`, and `Environments.tsx`.
*   **Keyboard Shortcuts Modal:** Add a hidden modal triggered by the `?` key that lists active keyboard shortcuts.
