import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { backendFetch, type OwnPlayerRatingProfile } from '@/lib/backendApi';
import { supabase } from '@/lib/supabase';

/**
 * Datos del Portal del atleta (rol `athlete`, 030_athlete_role.sql).
 *
 * Todo pasa por la ANON key + RLS: las políticas `*_athlete` solo devuelven
 * filas del propio jugador, así que un filtro olvidado acá NO filtra datos
 * ajenos — devuelve vacío. Igual se filtra explícitamente por jugador (no se
 * confía en "RLS lo resuelve" para que la intención quede escrita).
 *
 * Lo que se reutiliza tal cual de features/playerProfile/queries.ts:
 * usePlayerCore, usePlayerGpsSessions, usePlayerWellness, usePlayerVideoTracks,
 * usePlayerMediaUrl — sus consultas ya filtran por org_id + player_id y son
 * compatibles con las políticas del atleta.
 */

/** profiles.player_id del usuario logueado (profiles_select_own). */
export function useMyPlayerId(userId: string) {
  return useQuery({
    queryKey: ['athletePortal', 'playerId', userId],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.from('profiles').select('player_id').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return (data?.player_id as string | null | undefined) ?? null;
    },
    staleTime: 10 * 60_000,
  });
}

/** Ficha tipo FIFA: el backend saca el jugador del JWT (sin ids en la URL). */
export function getMyAthleteRating(): Promise<OwnPlayerRatingProfile> {
  return backendFetch('/v1/athlete/me/rating');
}

export interface MyVideoMetric {
  video_id: string;
  track_id: number;
  passes_made: number;
  passes_received: number;
  carries: number;
  carry_distance_m: number;
  progressive_passes: number;
  possession_time_s: number;
  shots: number;
  shots_on_target: number;
}

/**
 * video_player_metrics de los tracks del atleta. RLS (video_player_metrics_
 * select_athlete) ya restringe a sus pares (video_id, track_id); acá se pide
 * por video y se cruza por track en el cliente.
 */
export function useMyVideoMetrics(playerId: string | null, tracks: Array<{ video_id?: string; track_id: string | number }>) {
  const videoIds = [...new Set(tracks.map((track) => track.video_id).filter(Boolean))] as string[];
  return useQuery({
    queryKey: ['athletePortal', 'videoMetrics', playerId, videoIds.join(',')],
    enabled: !!playerId && videoIds.length > 0,
    queryFn: async (): Promise<MyVideoMetric[]> => {
      const { data, error } = await supabase
        .from('video_player_metrics')
        .select(
          'video_id, track_id, passes_made, passes_received, carries, carry_distance_m, progressive_passes, possession_time_s, shots, shots_on_target',
        )
        .in('video_id', videoIds);
      if (error) throw error;
      const mine = new Set(tracks.map((track) => `${track.video_id}:${track.track_id}`));
      return ((data ?? []) as MyVideoMetric[]).filter((row) => mine.has(`${row.video_id}:${row.track_id}`));
    },
  });
}

export interface MyInjury {
  injury_date: string;
  return_date: string | null;
  body_area: string | null;
  injury_type: string | null;
  severity: 'minor' | 'moderate' | 'severe';
}

/**
 * Historial de lesiones propio vía RPC `athlete_my_injuries()`: sin `notes`
 * ni `mechanism` (notas clínicas del staff). El atleta no tiene acceso a la
 * tabla `injuries`.
 */
export function useMyInjuries(playerId: string | null) {
  return useQuery({
    queryKey: ['athletePortal', 'injuries', playerId],
    enabled: !!playerId,
    queryFn: async (): Promise<MyInjury[]> => {
      const { data, error } = await supabase.rpc('athlete_my_injuries');
      if (error) throw error;
      return (data ?? []) as MyInjury[];
    },
  });
}

export interface WellnessCheckIn {
  entry_date: string;
  rpe: number;
  sleep_hours: number;
  sleep_quality: number;
  soreness: number;
  mood: number;
}

/**
 * Upsert del wellness del día. No manda `notes`: así un upsert del atleta no
 * pisa una nota que haya cargado el staff para ese mismo día (el ON CONFLICT
 * solo actualiza las columnas enviadas). RLS acepta solo su jugador y fechas
 * en [hoy-2, hoy+1] (UTC).
 */
export function useSubmitWellness(orgId: string, playerId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entry: WellnessCheckIn) => {
      if (!playerId) throw new Error('Cuenta sin jugador enlazado.');
      const { error } = await supabase
        .from('wellness_entries')
        .upsert({ org_id: orgId, player_id: playerId, ...entry }, { onConflict: 'player_id,entry_date' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playerProfile', 'wellness', playerId] });
    },
  });
}

/** Fecha local (YYYY-MM-DD) — no toISOString(), que es UTC y de noche ya es "mañana". */
export function localIsoDate(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface LinkablePlayer {
  id: string;
  full_name: string;
  is_active: boolean;
  /** user_id de la cuenta de atleta que ya lo tiene enlazado, si existe. */
  linked_user_id: string | null;
}

/**
 * Usuarios > Invitar como atleta: jugadores de la org y si ya tienen cuenta.
 * Solo se pide cuando el admin elige el rol atleta (`enabled`): `profiles.
 * player_id` no existe antes de correr 030 y no queremos romper el diálogo
 * para los roles de staff.
 */
export function useLinkablePlayers(orgId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['athletePortal', 'linkablePlayers', orgId],
    enabled,
    queryFn: async (): Promise<LinkablePlayer[]> => {
      const [playersRes, linksRes] = await Promise.all([
        supabase.from('players').select('id, full_name, is_active').eq('org_id', orgId).order('full_name'),
        supabase.from('profiles').select('user_id, player_id').eq('org_id', orgId).not('player_id', 'is', null),
      ]);
      if (playersRes.error) throw playersRes.error;
      if (linksRes.error) throw linksRes.error;
      const linkedBy = new Map((linksRes.data ?? []).map((row) => [row.player_id as string, row.user_id as string]));
      return (playersRes.data ?? []).map((player) => ({
        id: player.id as string,
        full_name: player.full_name as string,
        is_active: player.is_active as boolean,
        linked_user_id: linkedBy.get(player.id as string) ?? null,
      }));
    },
  });
}
