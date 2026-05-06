import { invoke } from "@tauri-apps/api/core";

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  state: "running" | "exited" | "paused" | "restarting" | string;
  ports: string[];
  created: number;
  compose_project?: string;
}

export interface ContainerDetails extends ContainerInfo {
  env: string[];
  mounts: string[];
  cmd: string[];
}

export interface HostStats {
  cpu_percent: number;
  mem_used_mb: number;
  mem_total_mb: number;
  disk_used_gb: number;
  disk_total_gb: number;
}

export interface ContainerStats {
  cpu_percent: number;
  mem_used_mb: number;
  mem_limit_mb: number;
}

export interface EnvVar {
  id: number;
  key: string;
  value: string;
  scope: string;
}

export interface NetworkContainer {
  name: string;
  ipv4: string;
  mac: string;
}

export interface NetworkInfo {
  id: string;
  name: string;
  driver: string;
  scope: string;
  subnet: string;
  gateway: string;
  containers: NetworkContainer[];
}

export interface DockerEvent {
  kind: string;
  action: string;
  actor: string;
  time: number;
}

export interface AppInfo {
  version: string;
  db_path: string;
}

export interface VolumeInfo {
  name: string;
  driver: string;
  mountpoint: string;
  scope: string;
  created: string;
}

export interface ImageInfo {
  id: string;
  repo_tags: string[];
  created: number;
  size: number;
  virtual_size: number;
  containers: number;
}

export interface PullProgress {
  id?: string;
  status?: string;
  progress?: string;
  current?: number;
  total?: number;
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
  stopLogs: () => invoke<void>("stop_logs"),
  streamDockerEvents: () => invoke<void>("stream_docker_events"),
  stopDockerEvents: () => invoke<void>("stop_docker_events"),
  getHostStats: () => invoke<HostStats>("get_host_stats"),
  listEnvVars: (scope?: string) => invoke<EnvVar[]>("list_env_vars", { scope: scope ?? null }),
  upsertEnvVar: (key: string, value: string, scope: string) =>
    invoke<EnvVar>("upsert_env_var", { key, value, scope }),
  deleteEnvVar: (id: number) => invoke<void>("delete_env_var", { id }),
  importEnvFile: (content: string, scope: string) => invoke<number>("import_env_file", { content, scope }),
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
  getSetting: (key: string) => invoke<string | null>("get_setting", { key }),
  setSetting: (key: string, value: string) => invoke<void>("set_setting", { key, value }),
};
