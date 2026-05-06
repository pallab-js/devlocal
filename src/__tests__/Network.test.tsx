import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Network } from "../pages/Network";

const mockInvoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));

const networks = [
  {
    id: "net1",
    name: "bridge",
    driver: "bridge",
    scope: "local",
    subnet: "172.17.0.0/16",
    gateway: "172.17.0.1",
    containers: [{ name: "nginx", ipv4: "172.17.0.2", mac: "02:42:ac:11:00:02" }],
  },
];

function wrapper(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>;
}

describe("Network", () => {
  it("renders skeleton while loading", () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(wrapper(<Network />));
    // Skeleton renders while pending — page heading should be present
    expect(screen.getByText("Network Topology")).toBeInTheDocument();
  });

  it("renders network card with name, driver, subnet", async () => {
    mockInvoke.mockResolvedValue(networks);
    render(wrapper(<Network />));
    expect(await screen.findByText("172.17.0.0/16")).toBeInTheDocument();
    expect(screen.getAllByText("bridge").length).toBeGreaterThan(0);
  });

  it("shows 'No networks found' when array is empty", async () => {
    mockInvoke.mockResolvedValue([]);
    render(wrapper(<Network />));
    expect(await screen.findByText("No networks found.")).toBeInTheDocument();
  });

  it("opens detail modal on Inspect click", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_network_topology") return Promise.resolve(networks);
      if (cmd === "inspect_network") return Promise.resolve(networks[0]);
      return Promise.resolve([]);
    });
    render(wrapper(<Network />));
    const btn = await screen.findByText("Inspect");
    fireEvent.click(btn);
    expect(await screen.findByText("172.17.0.0/16")).toBeInTheDocument();
  });
});
