import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'dark' | 'light';

interface UiState {
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  isCommandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  /** Temporada global (topbar). null = la más reciente disponible. */
  season: string | null;
  setSeason: (season: string | null) => void;
  theme: ThemeMode;
  toggleTheme: () => void;
}

/** Preferencias de UI persistidas en localStorage (sobreviven recargas). */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      isSidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
      isCommandPaletteOpen: false,
      setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
      season: null,
      setSeason: (season) => set({ season }),
      theme: 'dark',
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
    }),
    {
      name: 'athlos-ui',
      partialize: (state) => ({
        isSidebarCollapsed: state.isSidebarCollapsed,
        season: state.season,
        theme: state.theme,
      }),
    },
  ),
);
