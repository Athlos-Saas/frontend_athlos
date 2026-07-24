import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { getSignedMediaUrl, SIGNED_URL_TTL_SECONDS } from './mediaStorage';
import type {
  ConferenceBenchmark,
  GpsSession,
  Injury,
  LeagueAttackerStat,
  LeagueGoalkeeperStat,
  MlPrediction,
  Player,
  VideoPlayerTrack,
  WellnessEntry,
} from '@/types/domain';

/**
 * Un hook de react-query por dominio de datos — cada pestaña de la ficha
 * llama solo el/los que necesita, así no se pide todo de una vez ("consultas
 * independientes" del pedido). Todos filtran por org_id (multi-tenant) y
 * player_id; ninguno inventa datos: si la consulta no devuelve filas, el
 * caller recibe un arreglo/objeto vacío y decide mostrar "--"/ocultar.
 */

export interface PlayerCore extends Player {
  team_name: string | null;
  team_season: string | null;
}

export function usePlayerCore(orgId: string, playerId: string) {
  return useQuery({
    queryKey: ['playerProfile', 'core', playerId],
    queryFn: async (): Promise<PlayerCore | null> => {
      const { data: player, error } = await supabase
        .from('players')
        .select('id, full_name, position, birthdate, height_cm, weight_kg, photo_url, model_3d_url, is_active, team_id, updated_at')
        .eq('id', playerId)
        .eq('org_id', orgId)
        .maybeSingle();
      if (error) throw error;
      if (!player) return null;

      let teamName: string | null = null;
      let teamSeason: string | null = null;
      if (player.team_id) {
        const { data: team } = await supabase
          .from('teams')
          .select('name, season')
          .eq('id', player.team_id)
          .maybeSingle();
        teamName = team?.name ?? null;
        teamSeason = team?.season ?? null;
      }

      return { ...player, team_name: teamName, team_season: teamSeason };
    },
    staleTime: 5 * 60_000,
  });
}

export function usePlayerInjuries(orgId: string, playerId: string) {
  return useQuery({
    queryKey: ['playerProfile', 'injuries', playerId],
    queryFn: async (): Promise<Injury[]> => {
      const { data, error } = await supabase
        .from('injuries')
        .select('id, player_id, severity, notes, injury_date, return_date, body_area, injury_type, mechanism')
        .eq('org_id', orgId)
        .eq('player_id', playerId)
        .order('injury_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePlayerWellness(orgId: string, playerId: string) {
  return useQuery({
    queryKey: ['playerProfile', 'wellness', playerId],
    queryFn: async (): Promise<WellnessEntry[]> => {
      const { data, error } = await supabase
        .from('wellness_entries')
        .select('entry_date, player_id, rpe, sleep_hours, soreness, mood')
        .eq('org_id', orgId)
        .eq('player_id', playerId)
        .order('entry_date', { ascending: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePlayerGpsSessions(orgId: string, playerId: string) {
  return useQuery({
    queryKey: ['playerProfile', 'gpsSessions', playerId],
    queryFn: async (): Promise<GpsSession[]> => {
      const { data, error } = await supabase
        .from('gps_sessions')
        .select('id, session_date, distance_km, sprint_distance_m, top_speed_kmh, player_load, energy_kcal, work_ratio')
        .eq('org_id', orgId)
        .eq('player_id', playerId)
        .order('session_date', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePlayerPredictions(orgId: string, playerId: string) {
  return useQuery({
    queryKey: ['playerProfile', 'predictions', playerId],
    queryFn: async (): Promise<MlPrediction[]> => {
      const { data, error } = await supabase
        .from('ml_predictions')
        .select('prediction_type, label, score, features, created_at, gps_session_id')
        .eq('org_id', orgId)
        .eq('player_id', playerId)
        .order('created_at', { ascending: false })
        .limit(150);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface PlayerLeagueStats {
  attacker: LeagueAttackerStat[];
  goalkeeper: LeagueGoalkeeperStat[];
}

export function usePlayerLeagueStats(orgId: string, playerId: string) {
  return useQuery({
    queryKey: ['playerProfile', 'leagueStats', playerId],
    queryFn: async (): Promise<PlayerLeagueStats> => {
      const [attackerRes, goalkeeperRes] = await Promise.all([
        supabase
          .from('league_attacker_stats')
          .select(
            'id, player_id, season, competition, player_name, team_name, gp, goals, assists, points, shots, shots_on_goal, goals_per_game, assists_per_game, points_per_game, proba_top_scorer, role_name',
          )
          .eq('org_id', orgId)
          .eq('player_id', playerId),
        supabase
          .from('league_goalkeeper_stats')
          .select(
            'id, player_id, season, competition, player_name, team_name, gp, gaa, ga_per_game, saves_per_game, goals_against, saves, save_pct, gk_role',
          )
          .eq('org_id', orgId)
          .eq('player_id', playerId),
      ]);
      if (attackerRes.error) throw attackerRes.error;
      if (goalkeeperRes.error) throw goalkeeperRes.error;
      return { attacker: attackerRes.data ?? [], goalkeeper: goalkeeperRes.data ?? [] };
    },
  });
}

/**
 * conference_benchmarks es a nivel EQUIPO, no de jugador — se usa solo como
 * contexto en la pestaña Scouting, filtrado por la temporada/posición del
 * jugador, nunca presentado como si fuera un dato individual suyo.
 */
export function useTeamBenchmarks(
  orgId: string,
  season: string | null,
  positionGroup: 'attacker' | 'goalkeeper' | null,
) {
  return useQuery({
    queryKey: ['playerProfile', 'benchmarks', orgId, season, positionGroup],
    enabled: !!season && !!positionGroup,
    queryFn: async (): Promise<ConferenceBenchmark[]> => {
      const { data, error } = await supabase
        .from('conference_benchmarks')
        .select('position_group, team_name, metric, team_value, conference_value, diff')
        .eq('org_id', orgId)
        .eq('season', season as string)
        .eq('position_group', positionGroup as string);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface PlayerVideoTrack extends VideoPlayerTrack {
  video_title: string | null;
  match_date: string | null;
}

export function usePlayerVideoTracks(orgId: string, playerId: string) {
  return useQuery({
    queryKey: ['playerProfile', 'videoTracks', playerId],
    queryFn: async (): Promise<PlayerVideoTrack[]> => {
      const { data: tracks, error } = await supabase
        .from('video_player_tracks')
        .select('id, video_id, track_id, distance_m, time_visible_s, avg_speed_kmh, max_speed_kmh, matched_player_id')
        .eq('matched_player_id', playerId);
      if (error) throw error;
      if (!tracks || tracks.length === 0) return [];

      const videoIds = [...new Set(tracks.map((track) => track.video_id).filter(Boolean))] as string[];
      const { data: videos } = await supabase
        .from('video_analyses')
        .select('id, title, match_date')
        .eq('org_id', orgId)
        .in('id', videoIds.length > 0 ? videoIds : ['00000000-0000-0000-0000-000000000000']);
      const videoById = new Map((videos ?? []).map((video) => [video.id as string, video]));

      return tracks.map((track) => ({
        ...track,
        video_title: videoById.get(track.video_id ?? '')?.title ?? null,
        match_date: videoById.get(track.video_id ?? '')?.match_date ?? null,
      }));
    },
  });
}

/**
 * `player-media` es un bucket privado (igual que videos/processed/heatmaps/
 * reports) — cada ruta guardada en `photo_url`/`model_3d_url` necesita
 * firmarse para poder mostrarse. `staleTime` queda un poco por debajo del
 * TTL real de la URL firmada para refrescarla antes de que expire.
 */
export function usePlayerMediaUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['playerProfile', 'mediaUrl', path],
    queryFn: () => getSignedMediaUrl(path),
    enabled: !!path,
    staleTime: (SIGNED_URL_TTL_SECONDS - 15 * 60) * 1000,
  });
}
