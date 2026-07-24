import { QueryClient } from '@tanstack/react-query';

/**
 * Cliente único de react-query. Solo lo usa la ficha de jugador
 * (src/features/playerProfile) — el resto de la app sigue con
 * useState/useEffect + supabase-js directo, sin cambios.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
