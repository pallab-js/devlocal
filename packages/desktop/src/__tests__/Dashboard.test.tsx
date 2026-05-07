import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Dashboard } from "../pages/Dashboard";

const mockInvoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => {}) }));

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: vi.fn().mockImplementation(({ count, estimateSize }) => ({
    getVirtualItems: () => Array.from({ length: count }, (_, index) => ({
      index,
      start: index * estimateSize(index),
      size: estimateSize(index),
      key: index,
    })),
    getTotalSize: () => count * estimateSize(0),
    scrollToIndex: vi.fn(),
  })),
}));

const containers = [
  { id: "abc", name: "nginx", image: "nginx:latest", status: "Up", state: "running", ports: [], created: 0 },
  { id: "def", name: "redis", image: "redis:7", status: "Exited", state: "exited", ports: [], created: 0 },
];

function wrapper(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>;
}

describe("Dashboard", () => {
  it("renders container names after load", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_containers") return Promise.resolve(containers);
      if (cmd === "get_host_stats") return Promise.resolve({ cpu_percent: 10, mem_used_mb: 512, mem_total_mb: 8192, disk_used_gb: 20, disk_total_gb: 100 });
      if (cmd === "get_network_topology") return Promise.resolve([]);
      if (cmd === "stream_docker_events") return Promise.resolve();
      return Promise.resolve([]);
    });
    render(wrapper(<Dashboard />));
    expect(await screen.findByText("nginx")).toBeInTheDocument();
    expect(screen.getByText("redis")).toBeInTheDocument();
  });

  it("shows error when docker unavailable", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_containers") return Promise.reject(new Error("socket error"));
      if (cmd === "stream_docker_events") return Promise.resolve();
      return Promise.resolve(null);
    });
    render(wrapper(<Dashboard />));
    expect(await screen.findByText(/Docker unavailable/)).toBeInTheDocument();
  });

  it("shows stop button for running container", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_containers") return Promise.resolve([containers[0]]);
      if (cmd === "stream_docker_events") return Promise.resolve();
      return Promise.resolve(null);
    });
    render(wrapper(<Dashboard />));
    expect(await screen.findByText("Stop")).toBeInTheDocument();
  });
});
