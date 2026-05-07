import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Logs } from "../pages/Logs";

const mockInvoke = vi.hoisted(() => vi.fn());
const mockListen = vi.hoisted(() => vi.fn().mockResolvedValue(() => {}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: mockListen }));

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

function wrapper(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>;
}

describe("Logs", () => {
  it("shows placeholder when no container selected", async () => {
    mockInvoke.mockResolvedValue([]);
    render(wrapper(<Logs />));
    expect(await screen.findByText(/Select containers to stream logs/)).toBeInTheDocument();
  });

  it("renders all level filter buttons", () => {
    mockInvoke.mockResolvedValue([]);
    render(wrapper(<Logs />));
    for (const l of ["ALL", "DEBUG", "INFO", "WARN", "ERROR"]) {
      expect(screen.getByText(l)).toBeInTheDocument();
    }
  });

  it("renders tail options", () => {
    mockInvoke.mockResolvedValue([]);
    render(wrapper(<Logs />));
    expect(screen.getByText("Tail")).toBeInTheDocument();
  });

  it("shows container options in selector", async () => {
    mockInvoke.mockResolvedValue([
      { id: "abc", name: "nginx", image: "nginx", status: "Up", state: "running", ports: [], created: 0 },
    ]);
    render(wrapper(<Logs />));
    expect(await screen.findByText("nginx")).toBeInTheDocument();
  });

  it("shows search input", () => {
    mockInvoke.mockResolvedValue([]);
    render(wrapper(<Logs />));
    expect(screen.getByPlaceholderText("Search logs…")).toBeInTheDocument();
  });
});
