import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface NotificationsState {
  /** IDs de notificaciones ya vistas (`injury-<id>` / `ml-<id>`) — persistido en este navegador, no sincronizado entre dispositivos. */
  readIds: string[];
  markRead: (id: string) => void;
}

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set) => ({
      readIds: [],
      markRead: (id) => set((state) => (state.readIds.includes(id) ? state : { readIds: [...state.readIds, id] })),
    }),
    { name: 'athlos-notifications-read' },
  ),
);
