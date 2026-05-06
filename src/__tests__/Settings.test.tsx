import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Settings } from "../pages/Settings";

const mockInvoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: vi.fn().mockResolvedValue(null) }));

function wrapper(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>;
}

beforeEach(() => {
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === "get_app_info") return Promise.resolve({ version: "0.2.0", db_path: "/tmp/test.db" });
    return Promise.resolve(null);
  });
  localStorage.clear();
});

describe("Settings", () => {
  it("renders app version from get_app_info", async () => {
    render(wrapper(<Settings />));
    expect(await screen.findByText("0.2.0")).toBeInTheDocument();
  });

  it("Test button calls test_docker_connection and shows success", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_app_info") return Promise.resolve({ version: "0.2.0", db_path: "/tmp/test.db" });
      if (cmd === "test_docker_connection") return Promise.resolve("Docker 24.0 (API 1.43)");
      return Promise.resolve(null);
    });
    render(wrapper(<Settings />));
    fireEvent.click(screen.getByText("Test"));
    expect(await screen.findByText(/Docker 24.0/)).toBeInTheDocument();
  });

  it("Save intervals writes to localStorage", () => {
    render(wrapper(<Settings />));
    fireEvent.click(screen.getByText("Save intervals"));
    expect(localStorage.getItem("poll_containers")).toBeTruthy();
    expect(localStorage.getItem("poll_stats")).toBeTruthy();
  });

  it("Clear all shows confirm dialog; on confirm calls clear_all_env_vars", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_app_info") return Promise.resolve({ version: "0.2.0", db_path: "/tmp/test.db" });
      if (cmd === "clear_all_env_vars") return Promise.resolve(0);
      return Promise.resolve(null);
    });
    render(wrapper(<Settings />));
    fireEvent.click(screen.getByText("Clear all"));
    expect(await screen.findByText("Clear all env vars?")).toBeInTheDocument();
    fireEvent.click(screen.getAllByText("Clear all")[1]);
    expect(mockInvoke).toHaveBeenCalledWith("clear_all_env_vars");
  });
});
