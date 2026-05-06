export function TopBar() {
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
      <span
        style={{
          marginLeft: "auto",
          fontSize: 11,
          color: "var(--text-3)",
          fontFamily: "var(--font-mono)",
        }}
      >
        v0.2.0
      </span>
    </header>
  );
}
