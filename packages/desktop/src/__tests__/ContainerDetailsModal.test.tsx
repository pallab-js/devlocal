import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContainerDetailsModal } from "../components/ContainerDetailsModal";

const mockInvoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));

const details = {
  id: "abc", name: "nginx", image: "nginx:latest", status: "running", state: "running",
  ports: ["80:80"], created: 0, env: ["PATH=/usr/bin"], mounts: ["/data"], cmd: ["nginx", "-g", "daemon off;"],
};

describe("ContainerDetailsModal", () => {
  it("shows loading state initially", () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(<ContainerDetailsModal containerId="abc" onClose={() => {}} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("displays env vars, mounts, cmd after load", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "inspect_container") return Promise.resolve(details);
      if (cmd === "get_container_stats") return Promise.resolve({ cpu_percent: 5, mem_used_mb: 64, mem_limit_mb: 512 });
      return Promise.resolve(null);
    });
    render(<ContainerDetailsModal containerId="abc" onClose={() => {}} />);
    expect(await screen.findByText("PATH=/usr/bin")).toBeInTheDocument();
    expect(screen.getByText("/data")).toBeInTheDocument();
    expect(screen.getByText("nginx -g daemon off;")).toBeInTheDocument();
  });

  it("closes on × button click", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "inspect_container") return Promise.resolve(details);
      if (cmd === "get_container_stats") return Promise.resolve({ cpu_percent: 0, mem_used_mb: 0, mem_limit_mb: 0 });
      return Promise.resolve(null);
    });
    const onClose = vi.fn();
    render(<ContainerDetailsModal containerId="abc" onClose={onClose} />);
    await screen.findByText("PATH=/usr/bin");
    fireEvent.click(screen.getByText("×"));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on backdrop click", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "inspect_container") return Promise.resolve(details);
      if (cmd === "get_container_stats") return Promise.resolve({ cpu_percent: 0, mem_used_mb: 0, mem_limit_mb: 0 });
      return Promise.resolve(null);
    });
    const onClose = vi.fn();
    const { container } = render(<ContainerDetailsModal containerId="abc" onClose={onClose} />);
    await screen.findByText("PATH=/usr/bin");
    // Click the backdrop (outermost div)
    fireEvent.click(container.firstChild as Element);
    expect(onClose).toHaveBeenCalled();
  });
});
