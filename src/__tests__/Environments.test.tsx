import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Environments } from "../pages/Environments";

const mockInvoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));

const vars = [
  { id: 1, key: "API_KEY", value: "secret", scope: "global" },
  { id: 2, key: "DB_URL", value: "postgres://localhost", scope: "global" },
];

function wrapper(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>;
}

describe("Environments", () => {
  it("renders env var rows", async () => {
    mockInvoke.mockResolvedValue(vars);
    render(wrapper(<Environments />));
    expect(await screen.findByText("API_KEY")).toBeInTheDocument();
    expect(screen.getByText("DB_URL")).toBeInTheDocument();
  });

  it("shows confirmation dialog on delete click", async () => {
    mockInvoke.mockResolvedValue(vars);
    render(wrapper(<Environments />));
    const deleteButtons = await screen.findAllByText("Delete");
    fireEvent.click(deleteButtons[0]);
    expect(screen.getByText("Delete variable?")).toBeInTheDocument();
  });

  it("cancels delete dialog", async () => {
    mockInvoke.mockResolvedValue(vars);
    render(wrapper(<Environments />));
    const deleteButtons = await screen.findAllByText("Delete");
    fireEvent.click(deleteButtons[0]);
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText("Delete variable?")).not.toBeInTheDocument();
  });
});
