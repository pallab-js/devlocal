import { Outlet } from "react-router-dom";
import { TopBar } from "./TopBar";
import { SideNav } from "./SideNav";

export function AppShell() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <SideNav />
        <main className="flex-1 overflow-auto bg-bg p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
