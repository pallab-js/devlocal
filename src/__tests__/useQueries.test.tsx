import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useContainers, useContainerMutations, useEnvVarMutations } from "../hooks/useQueries";

const mockInvoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    ),
    qc,
  };
}

const containers = [
  { id: "a", name: "nginx", image: "nginx", status: "Up", state: "running", ports: [], created: 0 },
];

beforeEach(() => {
  mockInvoke.mockReset();
});

describe("useContainers", () => {
  it("calls list_containers and returns data", async () => {
    mockInvoke.mockResolvedValue(containers);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useContainers(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(containers);
    expect(mockInvoke).toHaveBeenCalledWith("list_containers");
  });
});

describe("useContainerMutations", () => {
  it("start mutation calls start_container then invalidates containers", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_containers") return Promise.resolve(containers);
      if (cmd === "start_container") return Promise.resolve(containers[0]);
      return Promise.resolve(null);
    });
    const { wrapper, qc } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useContainerMutations(), { wrapper });
    result.current.start.mutate("a");
    await waitFor(() => expect(result.current.start.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith("start_container", { id: "a" });
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["containers"] }));
  });
});

describe("useEnvVarMutations", () => {
  it("upsert mutation invalidates env-vars", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "upsert_env_var") return Promise.resolve({ id: 1, key: "FOO", value: "bar", scope: "global" });
      return Promise.resolve([]);
    });
    const { wrapper, qc } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useEnvVarMutations(), { wrapper });
    result.current.upsert.mutate({ key: "FOO", value: "bar", scope: "global" });
    await waitFor(() => expect(result.current.upsert.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["env-vars"] }));
  });
});
