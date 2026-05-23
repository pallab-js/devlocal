import { Outlet } from "react-router-dom";
import { SideNav } from "./SideNav";

export function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <SideNav />
      <main className="flex-1 overflow-auto bg-bg">
        <div className="p-6 animate-page-enter">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
