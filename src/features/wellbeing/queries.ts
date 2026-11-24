import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { backendFetch } from '@/lib/backendApi';
import { fetchPermissionSettings } from '@/lib/permissionSettings';
import { supabase } from '@/lib/supabase';
import { wellbeingAccessLevel, type WellbeingAccessLevel } from '@/utils/permissions';

import { compactAnswers, type WellbeingAnswers, type WellbeingKind } from './items';

/**
 * Bienestar psicológico (032_wellbeing_checkins.sql) — datos de SALUD MENTAL.
 *
 * - Escritura: directo a Supabase con la sesión del usuario. RLS acepta al
 *   atleta (solo lo suyo, fechas [hoy-2, hoy+1]) y a admin/medical con acceso
 *   detail. Las puntuaciones las calcula la base (trigger); el cliente solo
 *   manda respuestas.
 * - Lectura del perfil y de las banderas: backend (/v1/wellbeing), porque el
 *   coach ve por defecto solo banderas y RLS no puede servir agregados sin
 *   abrir las filas. Ver services/wellbeing_service.py.
 * - Nada de esto se loguea en consola ni se manda a AthlosBot.
 */

export interface WellbeingCheckinRow {
  entry_date: string;
  kind: WellbeingKind;
  answers: Record<string, number>;
  wants_to_talk: boolean;
}

/** Check-ins propios recientes (portal del atleta): para precargar hoy y saber si ya hizo el semanal. */
export function useMyWellbeingCheckins(orgId: string, playerId: string | null, sinceIso: string) {
  return useQuery({
    queryKey: ['wellbeing', 'mine', playerId, sinceIso],
    enabled: !!playerId,
    queryFn: async (): Promise<WellbeingCheckinRow[]> => {
      const { data, error } = await supabase
        .from('wellbeing_checkins')
        .select('entry_date, kind, answers, wants_to_talk')
        .eq('org_id', orgId)
        .eq('player_id', playerId as string)
        .gte('entry_date', sinceIso)
        .order('entry_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as WellbeingCheckinRow[];
    },
  });
}

/** Un check-in concreto (staff con acceso detail, para corregir lo ya cargado). */
export function useWellbeingCheckin(orgId: string, playerId: string, entryDate: string, kind: WellbeingKind, enabled: boolean) {
  return useQuery({
    queryKey: ['wellbeing', 'checkin', playerId, entryDate, kind],
    enabled: enabled && !!playerId && !!entryDate,
    queryFn: async (): Promise<WellbeingCheckinRow | null> => {
      const { data, error } = await supabase
        .from('wellbeing_checkins')
        .select('entry_date, kind, answers, wants_to_talk')
        .eq('org_id', orgId)
        .eq('player_id', playerId)
        .eq('entry_date', entryDate)
        .eq('kind', kind)
        .maybeSingle();
      if (error) throw error;
      return (data as WellbeingCheckinRow | null) ?? null;
    },
  });
}

export interface WellbeingSubmission {
  playerId: string;
  entryDate: string;
  kind: WellbeingKind;
  answers: WellbeingAnswers;
  wantsToTalk: boolean;
}

/**
 * Upsert por (player_id, entry_date, kind). Se manda el objeto de respuestas
 * COMPLETO: corregir reemplaza, no mezcla (un ítem que se deja en blanco al
 * corregir desaparece, que es lo que el usuario ve en pantalla).
 */
export function useSubmitWellbeing(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ playerId, entryDate, kind, answers, wantsToTalk }: WellbeingSubmission) => {
      const { error } = await supabase.from('wellbeing_checkins').upsert(
        {
          org_id: orgId,
          player_id: playerId,
          entry_date: entryDate,
          kind,
          answers: compactAnswers(answers),
          wants_to_talk: wantsToTalk,
        },
        { onConflict: 'player_id,entry_date,kind' },
      );
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['wellbeing', 'mine', variables.playerId] });
      queryClient.invalidateQueries({ queryKey: ['wellbeing', 'checkin', variables.playerId] });
      queryClient.invalidateQueries({ queryKey: ['wellbeing', 'profile', variables.playerId] });
      queryClient.invalidateQueries({ queryKey: ['wellbeing', 'flags'] });
    },
  });
}

/**
 * Nivel de acceso del usuario (staff) a partir de su rol y de los overrides de
 * la Matriz de permisos. Espejo de wellbeing_access_level() (SQL/Python): solo
 * decide qué se MUESTRA; RLS y el backend son los que impiden leer.
 */
export function useWellbeingAccess(orgId: string, role: string | null | undefined) {
  const settings = useQuery({
    queryKey: ['permissionSettings', orgId],
    enabled: role === 'medical' || role === 'coach',
    queryFn: () => fetchPermissionSettings(orgId),
    staleTime: 5 * 60_000,
  });
  let level: WellbeingAccessLevel;
  if (role !== 'medical' && role !== 'coach') {
    level = wellbeingAccessLevel(role, (_key, fallback) => fallback);
  } else if (settings.data) {
    const rows = settings.data.filter((row) => row.role === role);
    level = wellbeingAccessLevel(role, (key, fallback) => rows.find((row) => row.permission_key === key)?.allowed ?? fallback);
  } else {
    // Cargando o con error: no mostrar nada hasta saberlo (falla cerrado).
    level = 'none';
  }
  return { level, isLoading: settings.isLoading && settings.fetchStatus !== 'idle' };
}

// --- Backend: perfil y banderas -------------------------------------------

export type WellbeingFlagType = 'sustained_decline' | 'stress_spike' | 'wants_to_talk';
export type WellbeingStatus = 'ok' | 'attention' | 'building_baseline' | 'no_data';

export interface WellbeingFlag {
  type: WellbeingFlagType;
  date: string;
  since?: string;
  days?: number;
  count?: number;
  dimensions?: string[];
}

export interface DailyDimensionStats {
  key: string;
  mean_7d: number | null;
  mean_28d: number | null;
  n_7d: number;
  baseline: number | null;
  baseline_sd: number | null;
  baseline_n: number;
  baseline_ready: boolean;
  deviation: number | null;
  z: number | null;
  trend: 'up' | 'down' | 'stable' | null;
  trend_delta: number | null;
  latest: { date: string; score: number } | null;
}

export interface WeeklyDimensionStats {
  key: string;
  current: number | null;
  baseline: number | null;
  baseline_n: number;
  baseline_ready: boolean;
  deviation: number | null;
}

export type DailySeriesPoint = { date: string } & Partial<Record<string, number | null>>;

export interface WellbeingProfile {
  access: 'detail' | 'flags';
  player_id: string;
  reference_date: string;
  status: WellbeingStatus;
  flags: WellbeingFlag[];
  last_checkin_date: string | null;
  checkins_28d: number;
  daily?: { dimensions: DailyDimensionStats[]; series: DailySeriesPoint[] };
  weekly?: { latest_date: string | null; is_current: boolean; count: number; dimensions: WeeklyDimensionStats[] };
  parameters?: { current_window_days: number; baseline_window_days: number; baseline_min_obs: number; weekly_baseline_min: number; decline_rule: string };
}

export function usePlayerWellbeingProfile(orgId: string, playerId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['wellbeing', 'profile', playerId, orgId],
    enabled: enabled && !!playerId,
    queryFn: () => backendFetch<WellbeingProfile>(`/v1/wellbeing/players/${playerId}/profile?org_id=${orgId}`),
    // Salud mental: no conservar el perfil en caché más de lo necesario.
    gcTime: 60_000,
  });
}

export interface WellbeingFlagsResponse {
  access: WellbeingAccessLevel;
  reference_date?: string;
  players: Array<{ player_id: string; full_name: string; status: WellbeingStatus; flags: Array<{ type: WellbeingFlagType; date: string }> }>;
}

export function useWellbeingFlags(orgId: string) {
  return useQuery({
    queryKey: ['wellbeing', 'flags', orgId],
    queryFn: () => backendFetch<WellbeingFlagsResponse>(`/v1/wellbeing/flags?org_id=${orgId}`),
    gcTime: 60_000,
  });
}
