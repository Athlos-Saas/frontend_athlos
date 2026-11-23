/**
 * Cliente de "Mercado actual" (`/v1/market/*` en atlos-backend).
 *
 * Vive acá y no en `lib/backendApi.ts` para no chocar con otros módulos que
 * editan ese archivo en paralelo: de allí solo se importa `backendFetch`.
 * Los datos salen de `league_player_stats` (API-Football) y el backend es
 * quien calcula por-90 y percentiles — la UI no recalcula nada, solo muestra.
 */
import { useQuery } from '@tanstack/react-query';

import { backendFetch } from '@/lib/backendApi';
import { supabase } from '@/lib/supabase';

export type MarketPositionGroup = 'GK' | 'DEF' | 'MID' | 'FWD';
/** `table_missing`: falta aplicar la migración 022. `no_data`: no hay ligas cargadas. */
export type MarketStatus = 'ready' | 'table_missing' | 'no_data';
export type MarketMetricKind = 'per90' | 'ratio' | 'mean';

export interface MarketThresholds {
  min_minutes_percentile: number;
  min_pool_percentile: number;
  min_ratio_denominator: number;
  min_shared_metrics: number;
}

export interface MarketMetricDef {
  key: string;
  kind: MarketMetricKind;
  higher_is_better: boolean;
  typed: boolean;
  groups: MarketPositionGroup[];
}

export interface MarketLeague {
  provider: string;
  provider_league_id: string | null;
  competition: string;
  season: string;
  is_latest: boolean;
  players: number;
  with_minutes: number;
  eligible: number;
  own_linked: number;
  last_fetched_at: string | null;
}

export interface MarketTargetLeague {
  key: string;
  label: string;
  country: string;
  league_id: number;
  expected_players: number;
  loaded?: boolean;
}

export interface MarketLeaguesResponse {
  status: MarketStatus;
  thresholds: MarketThresholds;
  metrics?: MarketMetricDef[];
  radar_metrics?: Record<MarketPositionGroup, string[]>;
  leagues: MarketLeague[];
  targets: MarketTargetLeague[];
  ingestion: { api_key_configured: boolean; script: string };
}

export interface MarketPlayerRow {
  id: string;
  player_name: string;
  team_name: string;
  competition: string;
  season: string;
  provider: string;
  provider_player_id: string | null;
  position: string | null;
  position_group: MarketPositionGroup | null;
  age: number | null;
  /** `birth_date` = edad exacta a hoy; `provider_at_fetch` = la del proveedor el día de la ingesta. */
  age_source: 'birth_date' | 'provider_at_fetch' | null;
  age_as_of: string | null;
  nationality: string | null;
  appearances: number | null;
  minutes: number | null;
  goals: number | null;
  assists: number | null;
  own_player_id: string | null;
  eligible: boolean;
  pool_size: number | null;
  metrics: Record<string, number | null>;
  percentiles: Record<string, number | null>;
}

export interface MarketSearchResponse {
  status: MarketStatus;
  thresholds: MarketThresholds;
  percentile_scope?: 'competition' | 'pool';
  metrics?: MarketMetricDef[];
  radar_metrics?: Record<MarketPositionGroup, string[]>;
  pool?: Array<{ competition: string; season: string; players: number }>;
  facets?: { nationalities: Record<string, number> };
  total: number;
  rows: MarketPlayerRow[];
  notes?: string[];
}

export interface MarketSearchParams {
  competitions: string[];
  season: string | null;
  positions: MarketPositionGroup[];
  ageMin: number | null;
  ageMax: number | null;
  nationality: string | null;
  minMinutes: number | null;
  minAppearances: number | null;
  sortBy: string;
  sortOn: 'value' | 'percentile';
  percentileScope: 'competition' | 'pool';
}

export interface MarketReasonItem {
  metric: string;
  target_value: number | null;
  candidate_value: number | null;
  target_pct: number | null;
  candidate_pct: number | null;
}

export interface MarketSimilarCandidate extends MarketPlayerRow {
  similarity: number;
  shared_metrics: number;
  reasons: {
    shared_strengths: MarketReasonItem[];
    closest: MarketReasonItem[];
    main_difference: (MarketReasonItem & { candidate_better: boolean }) | null;
  };
}

export interface MarketSimilarResponse {
  status: MarketStatus;
  target?: MarketPlayerRow;
  target_low_sample?: boolean;
  candidates: MarketSimilarCandidate[];
  method?: { metrics_used?: string[]; pool_size?: number; reason?: string };
}

export type MarketComparability = 'comparable' | 'caution' | 'not_comparable';

export interface MarketCompareRow {
  metric: string;
  kind: MarketMetricKind;
  higher_is_better: boolean;
  own_value: number | null;
  candidate_value: number | null;
  own_pct: number | null;
  candidate_pct: number | null;
  status: MarketComparability;
  reason: string;
}

export interface MarketOwnOnlySource {
  source: 'gps' | 'video';
  sessions?: number;
  avg_distance_km?: number | null;
  max_top_speed_kmh?: number | null;
  avg_sprint_distance_m?: number | null;
  matched_tracks?: number;
  reason: string;
}

export interface MarketCompareResponse {
  status: MarketStatus;
  position_group?: MarketPositionGroup;
  own?: {
    player_id: string;
    full_name: string;
    position: string | null;
    position_group: MarketPositionGroup | null;
    age: number | null;
    market_row: MarketPlayerRow | null;
  };
  candidate?: MarketPlayerRow;
  rows?: MarketCompareRow[];
  own_only_sources?: MarketOwnOnlySource[];
  notes?: string[];
}

export interface RosterOption {
  id: string;
  full_name: string;
  position: string | null;
}

function searchQueryString(orgId: string, params: MarketSearchParams): string {
  const query = new URLSearchParams({ org_id: orgId, sort_by: params.sortBy, sort_on: params.sortOn });
  query.set('percentile_scope', params.percentileScope);
  if (params.competitions.length) query.set('competitions', params.competitions.join(','));
  if (params.season) query.set('season', params.season);
  if (params.positions.length) query.set('positions', params.positions.join(','));
  if (params.ageMin != null) query.set('age_min', String(params.ageMin));
  if (params.ageMax != null) query.set('age_max', String(params.ageMax));
  if (params.nationality) query.set('nationalities', params.nationality);
  if (params.minMinutes != null) query.set('min_minutes', String(params.minMinutes));
  if (params.minAppearances != null) query.set('min_appearances', String(params.minAppearances));
  query.set('limit', '500');
  return query.toString();
}

export function useMarketLeagues(orgId: string) {
  return useQuery({
    queryKey: ['market', 'leagues', orgId],
    queryFn: () => backendFetch<MarketLeaguesResponse>(`/v1/market/leagues?org_id=${encodeURIComponent(orgId)}`),
    staleTime: 5 * 60_000,
  });
}

export function useMarketSearch(orgId: string, params: MarketSearchParams | null) {
  return useQuery({
    queryKey: ['market', 'search', orgId, params],
    queryFn: () => backendFetch<MarketSearchResponse>(`/v1/market/players?${searchQueryString(orgId, params!)}`),
    enabled: params !== null,
    staleTime: 2 * 60_000,
  });
}

export function useMarketSimilar(
  orgId: string,
  rowId: string | null,
  scope: { competitions: string[]; season: string | null },
) {
  return useQuery({
    queryKey: ['market', 'similar', orgId, rowId, scope],
    queryFn: () => {
      const query = new URLSearchParams({ org_id: orgId, limit: '10' });
      if (scope.competitions.length) query.set('competitions', scope.competitions.join(','));
      if (scope.season) query.set('season', scope.season);
      return backendFetch<MarketSimilarResponse>(`/v1/market/players/${encodeURIComponent(rowId!)}/similar?${query}`);
    },
    enabled: rowId !== null,
    staleTime: 2 * 60_000,
  });
}

export function useMarketCompare(orgId: string, ownPlayerId: string | null, candidateId: string | null) {
  return useQuery({
    queryKey: ['market', 'compare', orgId, ownPlayerId, candidateId],
    queryFn: () => {
      const query = new URLSearchParams({ org_id: orgId, own_player_id: ownPlayerId!, candidate_id: candidateId! });
      return backendFetch<MarketCompareResponse>(`/v1/market/compare?${query}`);
    },
    enabled: ownPlayerId !== null && candidateId !== null,
    staleTime: 2 * 60_000,
  });
}

/** Roster propio para "comparar con mi jugador". Lectura directa con RLS, igual que el resto de páginas. */
export function useRosterOptions(orgId: string) {
  return useQuery({
    queryKey: ['market', 'roster', orgId],
    queryFn: async (): Promise<RosterOption[]> => {
      const { data, error } = await supabase
        .from('players')
        .select('id, full_name, position')
        .eq('org_id', orgId)
        .order('full_name');
      if (error) throw error;
      return (data as RosterOption[]) ?? [];
    },
    staleTime: 5 * 60_000,
  });
}
