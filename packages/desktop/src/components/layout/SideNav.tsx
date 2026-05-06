import { NavLink } from "react-router-dom";

const NAV = [
  { to: "/", label: "Dashboard", icon: "⬡" },
  { to: "/environments", label: "Environments", icon: "⚙" },
  { to: "/logs", label: "Logs", icon: "≡" },
  { to: "/network", label: "Network", icon: "◎" },
  { to: "/volumes", label: "Volumes", icon: "⬢" },
  { to: "/settings", label: "Settings", icon: "⊙" },
];

export function SideNav() {
  return (
    <nav className="w-[200px] bg-bg-deep border-r border-border flex flex-col py-3 shrink-0">
      {NAV.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }: { isActive: boolean }) => `
            flex items-center gap-[10px] px-4 py-2 text-[13px] font-medium transition-all duration-150 border-l-2 no-underline
            ${isActive ? "text-green bg-green/10 border-green" : "text-text-2 bg-transparent border-transparent"}
          `}
        >
          <span className="text-sm">{icon}</span>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
