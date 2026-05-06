import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ipc } from "../lib/ipc";

export function useContainers(paused = false) {
  return useQuery({
    queryKey: ["containers"],
    queryFn: () => ipc.listContainers(),
    refetchInterval: paused ? false : 5000,
  });
}

export function useContainerMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["containers"] });

  const start = useMutation({ mutationFn: ipc.startContainer, onSuccess: invalidate });
  const stop = useMutation({ mutationFn: ipc.stopContainer, onSuccess: invalidate });
  const restart = useMutation({ mutationFn: ipc.restartContainer, onSuccess: invalidate });

  return { start, stop, restart };
}

export function useHostStats(paused = false) {
  return useQuery({
    queryKey: ["host-stats"],
    queryFn: () => ipc.getHostStats(),
    refetchInterval: paused ? false : 3000,
  });
}

export function useEnvVars(scope?: string) {
  return useQuery({
    queryKey: ["env-vars", scope],
    queryFn: () => ipc.listEnvVars(scope),
  });
}

export function useEnvVarMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["env-vars"] });

  const upsert = useMutation({
    mutationFn: ({ key, value, scope }: { key: string; value: string; scope: string }) =>
      ipc.upsertEnvVar(key, value, scope),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: ipc.deleteEnvVar, onSuccess: invalidate });

  return { upsert, remove };
}

export function useNetworkTopology(paused = false) {
  return useQuery({
    queryKey: ["network-topology"],
    queryFn: () => ipc.getNetworkTopology(),
    refetchInterval: paused ? false : 10000,
  });
}
