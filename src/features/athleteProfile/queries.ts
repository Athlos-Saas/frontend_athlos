import { keepPreviousData, useQuery } from '@tanstack/react-query';

import {
  getAthleteProfileManage,
  getProfileRoster,
  getPublicAthleteProfile,
  getShowcaseAthlete,
  searchShowcase,
  type ShowcaseFilters,
} from './api';

/** Plantel propio con estado del perfil (solo admin/coach: `enabled`). */
export function useProfileRoster(orgId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['athleteProfile', 'roster', orgId],
    queryFn: () => getProfileRoster(orgId),
    enabled: enabled && !!orgId,
    staleTime: 30_000,
  });
}

export function useAthleteProfileManage(orgId: string, playerId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['athleteProfile', 'manage', orgId, playerId],
    queryFn: () => getAthleteProfileManage(orgId, playerId),
    enabled: enabled && !!orgId && !!playerId,
    staleTime: 30_000,
  });
}

/**
 * Ficha pública. Sin reintentos extra (backendFetchPublic ya cubre el
 * despertar de Render) ni caché larga: si el club despublica, la próxima
 * visita debe dejar de verla.
 */
export function usePublicAthleteProfile(slug: string) {
  return useQuery({
    queryKey: ['athleteProfile', 'public', slug],
    queryFn: () => getPublicAthleteProfile(slug),
    enabled: !!slug,
    retry: false,
    staleTime: 60_000,
  });
}

export function useShowcaseSearch(filters: ShowcaseFilters) {
  return useQuery({
    queryKey: ['athleteProfile', 'showcase', filters],
    queryFn: () => searchShowcase(filters),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useShowcaseAthlete(cardId: string | null) {
  return useQuery({
    queryKey: ['athleteProfile', 'showcaseDetail', cardId],
    queryFn: () => getShowcaseAthlete(cardId as string),
    enabled: !!cardId,
    staleTime: 60_000,
  });
}
