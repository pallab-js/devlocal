import { Outlet } from "react-router-dom";
import { TopBar } from "./TopBar";
import { SideNav } from "./SideNav";

export function AppShell() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <TopBar />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <SideNav />
        <main
          style={{
            flex: 1,
            overflow: "auto",
            background: "var(--bg)",
            padding: "1.5rem",
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
