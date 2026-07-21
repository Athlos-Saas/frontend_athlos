export interface Profile {
  user_id: string;
  org_id: string;
  full_name: string | null;
  role: string | null;
}

export interface MlModel {
  name: string;
  version: string;
  task: string;
  metrics: Record<string, number | string> | null;
  trained_at: string;
}

export interface MlPrediction {
  player_id?: string;
  prediction_type: string;
  label: string;
  score?: number;
  created_at: string;
}

export interface Player {
  id: string;
  full_name: string;
  position?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  birthdate?: string | null;
}

export interface GpsSession {
  session_date: string;
  distance_km: number;
  sprint_distance_m: number;
  top_speed_kmh: number;
  player_load: number;
}

export interface LeagueAttackerStat {
  player_name: string;
  team_name: string;
  goals: number;
  proba_top_scorer: number | null;
  role_name: string | null;
}

export interface LeagueGoalkeeperStat {
  player_name: string;
  team_name: string;
  gaa: number | null;
  save_pct: number | null;
  gk_role: string | null;
}

export interface ConferenceBenchmark {
  position_group: 'attacker' | 'goalkeeper';
  team_name: string;
  metric: string;
  team_value: number | null;
  conference_value: number | null;
  diff: number | null;
}

export interface Injury {
  player_id: string;
  severity: 'minor' | 'moderate' | 'severe';
  notes: string | null;
}

export interface VideoAnalysis {
  id: string;
  title: string;
  status: 'uploaded' | 'processing' | 'done' | 'failed';
  created_at: string;
}

export interface VideoPlayerTrack {
  track_id: string;
  distance_m: number;
  time_visible_s: number;
  avg_speed_kmh: number;
  max_speed_kmh: number;
}

export interface WellnessEntry {
  entry_date: string;
  player_id: string;
  rpe: number;
  sleep_hours: number;
  soreness: number;
  mood: number;
}
