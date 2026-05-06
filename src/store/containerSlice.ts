import { create } from "zustand";
import type { ContainerInfo } from "../lib/ipc";

interface ContainerStore {
  selected: string | null;
  setSelected: (id: string | null) => void;
}

export const useContainerStore = create<ContainerStore>((set) => ({
  selected: null,
  setSelected: (id) => set({ selected: id }),
}));

export type { ContainerInfo };
