import { create } from "zustand";

interface ContainerStore {
  selected: string | null;
  setSelected: (id: string | null) => void;
}

export const useContainerStore = create<ContainerStore>((set) => ({
  selected: null,
  setSelected: (id) => set({ selected: id }),
}));
