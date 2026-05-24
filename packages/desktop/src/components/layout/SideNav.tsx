import { useMemo } from "react";
import { NavLink } from "react-router-dom";
import { useContainers } from "../../hooks/useQueries";
import { useAppStore } from "../../store/useAppStore";

/* ── SVG Icons (Lucide-sourced, inline for zero dependency) ──────────────── */

const DashboardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="7" height="9" x="3" y="3" rx="1" />
    <rect width="7" height="5" x="14" y="3" rx="1" />
    <rect width="7" height="9" x="14" y="12" rx="1" />
    <rect width="7" height="5" x="3" y="16" rx="1" />
  </svg>
);

const EnvIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
  </svg>
);

const ImagesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </svg>
);

const LogsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 12h-5" />
    <path d="M15 8H9" />
    <path d="M19 17V5a2 2 0 0 0-2-2H4" />
    <path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3" />
  </svg>
);

const NetworkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="5" r="3" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <circle cx="5" cy="19" r="3" />
    <circle cx="19" cy="19" r="3" />
    <line x1="8.59" y1="17.51" x2="12" y2="16" />
    <line x1="15.41" y1="17.51" x2="12" y2="16" />
  </svg>
);

const VolumesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5V19A9 3 0 0 0 21 19V5" />
    <path d="M3 12A9 3 0 0 0 21 12" />
  </svg>
);

const SettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

/* ── Navigation Definition ───────────────────────────────────────────────── */

const SECTIONS = [
  {
    title: "Workspace",
    items: [
      { to: "/", label: "Dashboard", icon: DashboardIcon },
      { to: "/logs", label: "Logs", icon: LogsIcon },
    ],
  },
  {
    title: "Development",
    items: [
      { to: "/environments", label: "Environments", icon: EnvIcon },
    ],
  },
  {
    title: "Infrastructure",
    items: [
      { to: "/images", label: "Images", icon: ImagesIcon },
      { to: "/volumes", label: "Volumes", icon: VolumesIcon },
      { to: "/network", label: "Network", icon: NetworkIcon },
    ],
  },
  {
    title: "System",
    items: [
      { to: "/settings", label: "Settings", icon: SettingsIcon },
    ],
  },
];

/* ── Component ───────────────────────────────────────────────────────────── */

export function SideNav() {
  const { data: containers } = useContainers();
  const { activeProject, setActiveProject } = useAppStore();

  const projects = useMemo(() => {
    if (!containers) return [];
    const set = new Set<string>();
    containers.forEach((c) => {
      if (c.compose_project) set.add(c.compose_project);
    });
    return Array.from(set).sort();
  }, [containers]);

  return (
    <nav
      className="w-[210px] bg-bg-deep border-r border-border flex flex-col shrink-0 select-none"
      aria-label="Main navigation"
    >
      {/* Logo / Wordmark */}
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-border-light">
        <div
          className="w-2.5 h-2.5 rounded-full bg-green shrink-0"
          style={{ boxShadow: "0 0 8px var(--green)" }}
          aria-hidden="true"
        />
        <span className="font-mono text-[14px] font-bold text-green tracking-tight select-none">
          DevOpsLocal
        </span>
      </div>

      {/* Dynamic Project Workspace Selector */}
      <div className="px-3.5 py-3 border-b border-border-light flex flex-col gap-1.5 bg-bg-deep/50">
        <label className="text-[9px] font-mono font-bold uppercase tracking-wider text-text-3 select-none">
          Project Workspace
        </label>
        <select
          value={activeProject}
          onChange={(e) => setActiveProject(e.target.value)}
          className="w-full bg-surface border border-border rounded px-2.5 py-1.5 text-[11px] text-text font-mono outline-none focus:border-green focus:ring-1 focus:ring-green/30 transition-all cursor-pointer hover:bg-surface-2"
          aria-label="Select active project workspace"
        >
          <option value="all">🌐 All Projects</option>
          {projects.map((p) => (
            <option key={p} value={p}>
              📦 {p}
            </option>
          ))}
        </select>
      </div>

      {/* Nav Items Grouped by Section */}
      <div className="flex flex-col py-3 flex-1 overflow-y-auto gap-4">
        {SECTIONS.map((section) => (
          <div key={section.title} className="flex flex-col gap-0.5">
            <span className="px-4 text-[9px] font-mono font-bold uppercase tracking-wider text-text-3/65 mb-1 select-none">
              {section.title}
            </span>
            {section.items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }: { isActive: boolean }) =>
                  [
                    "group flex items-center gap-2.5 px-3.5 py-2 mx-2 my-0.5 rounded-lg text-[13px] font-medium transition-all duration-150 no-underline relative",
                    isActive
                      ? "text-green bg-green/10 shadow-[inset_0_0_0_1px_rgba(var(--color-green)/0.2)] font-semibold"
                      : "text-text-3 hover:text-text-2 hover:bg-surface-2",
                  ].join(" ")
                }
              >
                {({ isActive }: { isActive: boolean }) => (
                  <>
                    {/* Active left accent bar */}
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r bg-green"
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={`shrink-0 transition-colors ${
                        isActive ? "text-green" : "text-text-3 group-hover:text-text-2"
                      }`}
                      aria-hidden="true"
                    >
                      <Icon />
                    </span>
                    <span className="truncate">{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-3 border-t border-border-light bg-bg-deep">
        <p className="text-[10px] font-mono text-text-3 m-0">
          Press{" "}
          <kbd className="bg-surface-3 border border-border px-1 rounded text-[9px]">
            ?
          </kbd>{" "}
          for shortcuts
        </p>
      </div>
    </nav>
  );
}
