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
  gps_session_id?: string;
  prediction_type: string;
  label: string;
  score?: number;
  features?: Record<string, number> | null;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  sport?: string;
  season?: string | null;
}

export interface Organization {
  id: string;
  name: string;
  plan?: string;
  country?: string | null;
}

export interface Player {
  id: string;
  full_name: string;
  position?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  birthdate?: string | null;
  photo_url?: string | null;
  model_3d_url?: string | null;
  is_active?: boolean;
  team_id?: string;
  updated_at?: string;
}

export interface GpsSession {
  id: string;
  session_date: string;
  distance_km: number;
  sprint_distance_m: number;
  top_speed_kmh: number;
  player_load: number;
  energy_kcal?: number | null;
  work_ratio?: number | null;
}

export interface LeagueAttackerStat {
  id: string;
  player_id?: string | null;
  season?: string;
  competition?: string;
  player_name: string;
  team_name: string;
  gp?: number | null;
  goals: number;
  assists?: number | null;
  points?: number | null;
  shots?: number | null;
  shots_on_goal?: number | null;
  goals_per_game?: number | null;
  assists_per_game?: number | null;
  points_per_game?: number | null;
  proba_top_scorer: number | null;
  role_name: string | null;
}

export interface LeagueGoalkeeperStat {
  id: string;
  player_id?: string | null;
  season?: string;
  competition?: string;
  player_name: string;
  team_name: string;
  gp?: number | null;
  gaa: number | null;
  ga_per_game?: number | null;
  saves_per_game?: number | null;
  goals_against?: number | null;
  saves?: number | null;
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
  id: string;
  player_id: string;
  severity: 'minor' | 'moderate' | 'severe';
  notes: string | null;
  injury_date?: string;
  return_date?: string | null;
  body_area?: string | null;
  injury_type?: string | null;
  mechanism?: string | null;
}

export interface VideoAnalysis {
  id: string;
  title: string;
  status: 'uploaded' | 'processing' | 'done' | 'failed';
  created_at: string;
  match_date?: string | null;
  storage_path?: string | null;
  processed_path?: string | null;
  error_message?: string | null;
}

export interface VideoPlayerTrack {
  id?: string;
  video_id?: string;
  matched_player_id?: string | null;
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
