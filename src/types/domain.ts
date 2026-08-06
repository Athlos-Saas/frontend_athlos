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
  /** Foto para el visor de media (PlayerMedia.tsx) — distinta de photo_url (avatar de perfil). Si no está seteada, el visor cae de respaldo a photo_url. */
  action_photo_url?: string | null;
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

/** Jugador similar por distancia euclídea en el espacio estandarizado del
 * clustering de roles — ver `_nearest_neighbors` en technical_ml_service.py. */
export interface SimilarPlayer {
  player_name: string;
  team_name: string;
  distance: number;
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
  similar_players?: SimilarPlayer[];
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
  similar_players?: SimilarPlayer[];
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
  yolo_model?: string | null;
  /** Cantidad de posiciones guardadas en el artefacto de tracking. Su
   * presencia es la señal de que el video se procesó con el pipeline que
   * genera las capas analíticas: los videos anteriores lo tienen en null. */
  tracking_points?: number | null;
  event_stats?: VideoEventStats | null;
  metrics_stats?: VideoMetricsStats | null;
}

/** Diagnóstico de la detección de eventos. El backend lo escribe SIEMPRE,
 * sobre todo cuando no salió nada: `skipped_reason` es lo que permite explicar
 * un cero en vez de mostrarlo pelado. */
export interface VideoEventStats {
  total_frames?: number;
  ball_frames?: number;
  ball_coverage?: number;
  possession_frames?: number;
  possession_spells?: number;
  events_total?: number;
  events_by_type?: Record<string, number>;
  pitch_calibrated?: boolean;
  calibration_coverage?: number | null;
  team_silhouette?: number | null;
  team_colors?: Record<string, string>;
  yolo_model?: string | null;
  /** 'dedicated' = detector de pelota entrenado para fútbol; 'coco' = clase
   * genérica de respaldo, que encuentra mucha menos pelota. */
  ball_detector?: 'dedicated' | 'coco';
  frame_aspect?: number | null;
  /** Más fuerte que `pitch_calibrated`: false solo cuando NO hubo homografía
   * Y además el encuadre (vertical, típicamente) hace que la escala de
   * respaldo no signifique nada. Distingue "aproximado" de "no usable". */
  geometry_usable?: boolean;
  fallback_warning?: string;
  skipped_reason?: string;
  warnings?: string[];
}

export interface VideoMetricsStats {
  tracks?: number;
  points?: number;
  ball_points?: number;
  pitch_calibrated?: boolean;
  /** false cuando las coordenadas salen de la escala lineal de respaldo: las
   * métricas en metros son aproximadas y la UI tiene que decirlo. */
  geometry_reliable?: boolean;
  /** false cuando además el encuadre no es apaisado: ahí los metros no son
   * "aproximados", directamente no se pueden usar. */
  geometry_usable?: boolean;
  frame_aspect?: number | null;
  possession_spells?: number;
  shape_frames_by_team?: Record<string, number>;
  player_rows?: number;
  team_rows?: number;
  shape_skipped_reason?: string;
  skipped_reason?: string;
  failed_reason?: string;
  warnings?: string[];
}

export type VideoEventType = 'pass' | 'turnover' | 'possession_change' | 'carry';

export interface VideoEvent {
  id: string;
  event_type: VideoEventType;
  frame: number;
  t_s: number;
  end_t_s?: number | null;
  track_id?: number | null;
  end_track_id?: number | null;
  team_cluster?: number | null;
  end_team_cluster?: number | null;
  start_x_m?: number | null;
  start_y_m?: number | null;
  end_x_m?: number | null;
  end_y_m?: number | null;
  length_m?: number | null;
  duration_s?: number | null;
  progress_m?: number | null;
}

/** Grilla de ocupación normalizada (suma 1), en orden fila-mayor desde y=0. */
export interface VideoHeatmap {
  cols: number;
  rows: number;
  points: number;
  grid: number[];
}

export interface VideoPlayerMetrics {
  track_id: number;
  team_cluster?: number | null;
  heatmap?: VideoHeatmap | Record<string, never> | null;
  passes_made: number;
  passes_received: number;
  turnovers_lost: number;
  turnovers_won: number;
  carries: number;
  carry_distance_m: number;
  progressive_passes: number;
  progression_m: number;
  possession_time_s: number;
}

export interface VideoTeamMetrics {
  team_cluster: number;
  mean_width_m?: number | null;
  mean_depth_m?: number | null;
  mean_area_m2?: number | null;
  mean_compactness_m?: number | null;
  mean_centroid_x_m?: number | null;
  mean_centroid_y_m?: number | null;
  defensive_line_m?: number | null;
  frames_sampled: number;
  mean_players_visible?: number | null;
  possession_time_s: number;
  possession_share?: number | null;
  passes: number;
  turnovers: number;
  pass_network: { from: number; to: number; count: number }[];
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
  shirt_color?: string | null;
  /** Equipo (0/1) que asignó el backend agrupando por color de camiseta.
   * null cuando no acumuló color suficiente o los dos kits no separan. */
  team_cluster?: number | null;
}

export interface WellnessEntry {
  entry_date: string;
  player_id: string;
  rpe: number;
  sleep_hours: number;
  soreness: number;
  mood: number;
}
