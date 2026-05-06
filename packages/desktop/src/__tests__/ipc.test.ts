import { describe, it, expect, vi } from "vitest";

const mockInvoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));

const { ipc } = await import("../lib/ipc");

describe("ipc wrappers", () => {
  it("listContainers calls list_containers", async () => {
    mockInvoke.mockResolvedValueOnce([]);
    const result = await ipc.listContainers();
    expect(mockInvoke).toHaveBeenCalledWith("list_containers");
    expect(result).toEqual([]);
  });

  it("startContainer passes id", async () => {
    const container = { id: "abc", name: "test", image: "nginx", status: "running", state: "running", ports: [], created: 0 };
    mockInvoke.mockResolvedValueOnce(container);
    const result = await ipc.startContainer("abc");
    expect(mockInvoke).toHaveBeenCalledWith("start_container", { id: "abc" });
    expect(result.id).toBe("abc");
  });

  it("upsertEnvVar passes key/value/scope", async () => {
    const envVar = { id: 1, key: "FOO", value: "bar", scope: "global" };
    mockInvoke.mockResolvedValueOnce(envVar);
    const result = await ipc.upsertEnvVar("FOO", "bar", "global");
    expect(mockInvoke).toHaveBeenCalledWith("upsert_env_var", { key: "FOO", value: "bar", scope: "global" });
    expect(result.key).toBe("FOO");
  });
});
