import { invoke } from "@tauri-apps/api/core";
import type {
  AppError, AppInfo, ContainerInfo, ContainerDetails, ContainerStats, DockerEvent,
  EnvVar, HostStats, ImageInfo, ImportResult, LogLine, NetworkContainer, NetworkInfo,
  PullProgress, VolumeInfo, DbSchema, DbQueryResult, DbTable,
} from "@devopslocal/shared";
export type {
  AppError, AppInfo, ContainerInfo, ContainerDetails, ContainerStats, DockerEvent,
  EnvVar, HostStats, ImageInfo, ImportResult, LogLine, NetworkContainer, NetworkInfo,
  PullProgress, VolumeInfo, DbSchema, DbQueryResult, DbTable,
};

export function isAppError(e: unknown): e is AppError {
  return typeof e === "object" && e !== null && "code" in e && "message" in e;
}

export const ipc = {
  getAppInfo: () => invoke<AppInfo>("get_app_info"),
  testDockerConnection: (socketPath?: string) =>
    invoke<string>("test_docker_connection", { socketPath: socketPath ?? null }),
  clearAllEnvVars: () => invoke<number>("clear_all_env_vars"),
  listContainers: () => invoke<ContainerInfo[]>("list_containers"),
  startContainer: (id: string) => invoke<ContainerInfo>("start_container", { id }),
  stopContainer: (id: string) => invoke<ContainerInfo>("stop_container", { id }),
  restartContainer: (id: string) => invoke<ContainerInfo>("restart_container", { id }),
  updateContainerLimits: (id: string, cpuShares?: number, memoryBytes?: number) =>
    invoke<void>("update_container_limits", { id, cpuShares: cpuShares ?? null, memoryBytes: memoryBytes ?? null }),
  inspectContainer: (id: string) => invoke<ContainerDetails>("inspect_container", { id }),
  getContainerStats: (id: string) => invoke<ContainerStats>("get_container_stats", { id }),
  streamLogs: (containerId: string, tail?: number) =>
    invoke<void>("stream_logs", { containerId, tail: tail ?? null }),
  stopLogs: (containerId?: string) => invoke<void>("stop_logs", { containerId: containerId ?? null }),
  streamDockerEvents: () => invoke<void>("stream_docker_events"),
  stopDockerEvents: () => invoke<void>("stop_docker_events"),
  getHostStats: () => invoke<HostStats>("get_host_stats"),
  listEnvVars: (scope?: string) => invoke<EnvVar[]>("list_env_vars", { scope: scope ?? null }),
  upsertEnvVar: (key: string, value: string, scope: string) =>
    invoke<EnvVar>("upsert_env_var", { key, value, scope }),
  deleteEnvVar: (id: number, scope: string) => invoke<void>("delete_env_var", { id, scope }),
  importEnvFile: (content: string, scope: string) => invoke<ImportResult>("import_env_file", { content, scope }),
  importSecrets: (content: string, format: string, scope: string) => invoke<ImportResult>("import_secrets", { content, format, scope }),
  exportEnvScope: (scope: string) => invoke<string>("export_env_scope", { scope }),
  getNetworkTopology: () => invoke<NetworkInfo[]>("get_network_topology"),
  inspectNetwork: (id: string) => invoke<NetworkInfo>("inspect_network", { id }),
  listVolumes: () => invoke<VolumeInfo[]>("list_volumes"),
  pruneVolumes: () => invoke<number>("prune_volumes"),
  listImages: () => invoke<ImageInfo[]>("list_images"),
  pullImage: (image: string, tag: string) => invoke<void>("pull_image", { image, tag }),
  deleteImage: (id: string, force?: boolean) => invoke<void>("delete_image", { id, force: force ?? false }),
  pruneImages: () => invoke<number>("prune_images"),
  composeUp: (projectName: string, configDir: string) =>
    invoke<void>("compose_up", { projectName, configDir }),
  composeDown: (projectName: string, configDir: string) =>
    invoke<void>("compose_down", { projectName, configDir }),
  inspectVolume: (name: string) => invoke<Record<string, unknown>>("inspect_volume", { name }),
  getSetting: (key: string) => invoke<string | null>("get_setting", { key }),
  setSetting: (key: string, value: string) => invoke<void>("set_setting", { key, value }),
  dbConnect: (path: string) => invoke<DbSchema>("db_connect", { path }),
  dbExecuteQuery: (path: string, sql: string) => invoke<DbQueryResult>("db_execute_query", { path, sql }),
};
