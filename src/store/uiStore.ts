import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiState {
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  isCommandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
}

/** `isSidebarCollapsed` se persiste en localStorage — el menú se queda
 * colapsado/expandido entre recargas, no solo mientras dura la sesión. */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      isSidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
      isCommandPaletteOpen: false,
      setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
    }),
    {
      name: 'athlos-ui',
      partialize: (state) => ({ isSidebarCollapsed: state.isSidebarCollapsed }),
    },
  ),
);
