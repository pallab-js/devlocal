import { useTheme } from "../../hooks/useTheme";

const SunIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </svg>
);

const MoonIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);

export function TopBar() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header
      style={{
        background: "var(--bg-deep)",
        borderBottom: "1px solid var(--border)",
        height: "48px",
        display: "flex",
        alignItems: "center",
        padding: "0 1.25rem",
        gap: "10px",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: "var(--green)",
          boxShadow: "0 0 8px var(--green)",
        }}
      />
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 16,
          fontWeight: 700,
          color: "var(--green)",
          letterSpacing: "-0.5px",
        }}
      >
        DevOpsLocal
      </span>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "12px" }}>
        <button
          onClick={toggleTheme}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-2)",
            cursor: "pointer",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "4px",
            transition: "background 0.2s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = "var(--surface-3)")}
          onMouseOut={(e) => (e.currentTarget.style.background = "none")}
          title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
          {theme === "light" ? <MoonIcon /> : <SunIcon />}
        </button>

        <span
          style={{
            fontSize: 11,
            color: "var(--text-3)",
            fontFamily: "var(--font-mono)",
          }}
        >
          v0.2.0
        </span>
      </div>
    </header>
  );
}
