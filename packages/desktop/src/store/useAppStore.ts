import { create } from "zustand";

interface AppState {
  /** Whether the Docker daemon is reachable */
  dockerOnline: boolean;
  setDockerOnline: (online: boolean) => void;

  /** The container ID currently selected in the details modal */
  activeContainerId: string | null;
  setActiveContainerId: (id: string | null) => void;

  /** The currently selected workspace/compose project filter */
  activeProject: string;
  setActiveProject: (project: string) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  dockerOnline: true, // optimistic default; corrected by initial ping in App.tsx
  setDockerOnline: (online) => set({ dockerOnline: online }),

  activeContainerId: null,
  setActiveContainerId: (id) => set({ activeContainerId: id }),

  activeProject: "all",
  setActiveProject: (project) => set({ activeProject: project }),
}));
