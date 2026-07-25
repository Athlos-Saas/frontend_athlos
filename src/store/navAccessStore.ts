import { create } from 'zustand';

interface NavAccessState {
  /** nav_key (NavItem.to) que el rol actual tiene explícitamente denegados. */
  deniedKeys: Set<string>;
  setDeniedKeys: (keys: Set<string>) => void;
}

export const useNavAccessStore = create<NavAccessState>((set) => ({
  deniedKeys: new Set(),
  setDeniedKeys: (keys) => set({ deniedKeys: keys }),
}));
