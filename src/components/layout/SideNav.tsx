import { NavLink } from "react-router-dom";

const NAV = [
  { to: "/", label: "Dashboard", icon: "⬡" },
  { to: "/environments", label: "Environments", icon: "⚙" },
  { to: "/logs", label: "Logs", icon: "≡" },
  { to: "/network", label: "Network", icon: "◎" },
  { to: "/settings", label: "Settings", icon: "⊙" },
];

export function SideNav() {
  return (
    <nav
      style={{
        width: 200,
        background: "var(--bg-deep)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        padding: "0.75rem 0",
        flexShrink: 0,
      }}
    >
      {NAV.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          style={({ isActive }) => ({
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 500,
            color: isActive ? "var(--green)" : "var(--text-2)",
            background: isActive ? "var(--green-dim)" : "transparent",
            borderLeft: isActive ? "2px solid var(--green)" : "2px solid transparent",
            textDecoration: "none",
            transition: "all 0.15s",
          })}
        >
          <span style={{ fontSize: 14 }}>{icon}</span>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
