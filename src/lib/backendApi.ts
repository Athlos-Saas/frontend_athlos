import { supabase } from '@/lib/supabase';

export function getBackendUrl(): string | null {
  return import.meta.env.VITE_API_URL ?? null;
}

/**
 * Ping best-effort a /health — no autentica, no revienta si falla. Se usa
 * mientras hay un video "processing" para evitar que el plan free de Render
 * duerma el backend a mitad de un análisis en curso (se duerme por falta de
 * tráfico HTTP entrante, sin importar que el worker siga corriendo adentro).
 * No es una garantía total: si el usuario cierra la pestaña, deja de pinguear.
 */
export function pingBackend(): void {
  const backendUrl = getBackendUrl();
  if (!backendUrl) return;
  fetch(`${backendUrl}/health`).catch(() => {});
}

/**
 * Mensaje cuando `fetch` lanza. En producción casi nunca significa "backend
 * apagado": Render responde 502/503 SIN cabeceras CORS mientras el servicio
 * despierta del plan free o reinicia (p. ej. tras quedarse sin RAM), y el
 * navegador lo reporta como error de red. Decir "no está conectado" hacía
 * creer que faltaba configuración cuando bastaba con reintentar.
 */
function unreachableMessage(backendUrl: string): string {
  return `El backend (${backendUrl}) no respondió: puede estar despertando o reiniciándose. Reintenta en unos segundos.`;
}

/** Esperas entre reintentos (ms): ~26 s en total, lo que tarda Render en despertar. */
const WAKE_RETRY_DELAYS_MS = [3000, 8000, 15000];

/**
 * fetch que reintenta SOLO lecturas (GET) ante error de red — cubre el
 * despertar/reinicio de Render sin que el usuario vea un error. Las
 * escrituras no se reintentan: un POST que sí llegó (crear rival, disparar
 * un análisis) se duplicaría.
 */
async function fetchWithWakeRetry(url: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const delays = method === 'GET' ? WAKE_RETRY_DELAYS_MS : [];
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fetch(url, init);
    } catch (error) {
      if (attempt >= delays.length) throw error;
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    }
  }
}

export interface TrainingResult {
  model_name: string;
  model_version: string;
  metrics: Record<string, unknown>;
  predictions_written: number;
}

/**
 * Dispara el entrenamiento en atlos-backend (POST /v1/ml/train/{kind}) usando
 * la sesión del propio usuario en vez del x-api-key interno. Requiere que el
 * backend FastAPI esté corriendo y accesible desde el navegador — no es el
 * caso por defecto (ver VITE_API_URL en .env.example).
 */
export async function triggerTraining(
  kind: 'physical' | 'technical' | 'injury_risk',
  params: Record<string, string>,
): Promise<TrainingResult[]> {
  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    throw new Error('VITE_API_URL no está configurado: no hay un backend accesible desde el navegador.');
  }

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No hay sesión activa.');

  const query = new URLSearchParams(params).toString();
  let response: Response;
  try {
    response = await fetch(`${backendUrl}/v1/ml/train/${kind}?${query}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new Error(unreachableMessage(backendUrl));
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? `El backend respondió ${response.status}.`);
  }

  return response.json();
}

/**
 * Dispara el worker de computer vision (POST /v1/videos/{id}/process) con la
 * sesión del propio usuario, igual que triggerTraining. Requiere backend
 * accesible desde el navegador (VITE_API_URL).
 */
export type YoloModelKey = 'nano' | 'small';

export async function triggerVideoProcessing(
  orgId: string,
  videoId: string,
  yoloModel: YoloModelKey = 'nano',
): Promise<{ video_id: string; status: string; yolo_model: string }> {
  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    throw new Error('VITE_API_URL no está configurado: no hay un backend accesible desde el navegador.');
  }

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No hay sesión activa.');

  let response: Response;
  try {
    response = await fetch(`${backendUrl}/v1/videos/${videoId}/process?org_id=${orgId}&yolo_model=${yoloModel}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new Error(unreachableMessage(backendUrl));
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? `El backend respondió ${response.status}.`);
  }

  return response.json();
}

/** fetch autenticado genérico contra atlos-backend con la sesión del usuario. */
export async function backendFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    throw new Error('VITE_API_URL no está configurado: no hay un backend accesible desde el navegador.');
  }

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No hay sesión activa.');

  let response: Response;
  try {
    response = await fetchWithWakeRetry(`${backendUrl}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new Error(unreachableMessage(backendUrl));
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? `El backend respondió ${response.status}.`);
  }

  return response.json();
}

// --- Gestión de usuarios (solo admin; el backend valida el rol) ---

/** Espejo de public.user_role ('athlete' desde 030_athlete_role.sql). */
export type OrgUserRole = 'admin' | 'coach' | 'medical' | 'analyst' | 'viewer' | 'athlete';

export interface OrgUser {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: OrgUserRole;
  created_at: string;
}

export function listOrgUsers(orgId: string): Promise<OrgUser[]> {
  return backendFetch(`/v1/users?org_id=${orgId}`);
}

export function inviteOrgUser(
  orgId: string,
  // player_id: obligatorio (y solo válido) con role 'athlete' — el backend lo valida contra la org.
  payload: { email: string; full_name: string; role: OrgUserRole; player_id?: string },
): Promise<{ user_id: string; email: string }> {
  return backendFetch(`/v1/users/invite?org_id=${orgId}`, { method: 'POST', body: JSON.stringify(payload) });
}

export function updateOrgUserRole(orgId: string, userId: string, role: OrgUserRole): Promise<OrgUser> {
  return backendFetch(`/v1/users/${userId}/role?org_id=${orgId}`, { method: 'PATCH', body: JSON.stringify({ role }) });
}

export function deleteOrgUser(orgId: string, userId: string): Promise<{ deleted: string }> {
  return backendFetch(`/v1/users/${userId}?org_id=${orgId}`, { method: 'DELETE' });
}

// --- AthlosBot (asistente de IA, admin y coach) ---

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantWatchItem {
  player_name: string;
  reason: string;
}

/** Lo que la persona está mirando ahora mismo — una PISTA para AthlosBot,
 * nunca dato confirmado (puede estar desactualizada). Espejo de
 * AssistantScreenContext en atlos/schemas/models.py. */
export interface AssistantScreenContext {
  route?: string;
  tab?: 'resumen' | 'partidos';
  team_id?: string;
  team_name?: string;
  selected_player_id?: string;
  selected_player_name?: string;
  selected_video_id?: string;
  selected_video_title?: string;
  available_count?: number;
  injured_count?: number;
  watch_items?: AssistantWatchItem[];
}

export interface AssistantProposedAction {
  action_id: string;
  action_type: string;
  description: string;
  payload: Record<string, unknown>;
}

export interface AssistantChatResult {
  reply: string;
  proposed_action: AssistantProposedAction | null;
}

export interface AssistantActionResult {
  action_id: string;
  status: 'executed' | 'failed' | 'rejected';
  result?: Record<string, unknown> | null;
  error?: string | null;
}

export function sendAssistantMessage(
  orgId: string,
  message: string,
  history: AssistantMessage[],
  screenContext?: AssistantScreenContext | null,
): Promise<AssistantChatResult> {
  return backendFetch(`/v1/assistant/chat?org_id=${orgId}`, {
    method: 'POST',
    body: JSON.stringify({ message, history, screen_context: screenContext ?? null }),
  });
}

export function confirmAssistantAction(orgId: string, actionId: string): Promise<AssistantActionResult> {
  return backendFetch(`/v1/assistant/actions/${actionId}/confirm?org_id=${orgId}`, { method: 'POST' });
}

export function rejectAssistantAction(orgId: string, actionId: string): Promise<AssistantActionResult> {
  return backendFetch(`/v1/assistant/actions/${actionId}/reject?org_id=${orgId}`, { method: 'POST' });
}

export type ReportType = 'team_readiness' | 'watchlist' | 'match_report';

export interface GenerateReportRequest {
  report_type: ReportType;
  team_id?: string;
  video_id?: string;
}

export interface GenerateReportResult {
  report_id: string;
  title: string;
  download_url: string | null;
  expires_in_seconds: number;
}

/** Dispara el reporte directo desde un botón (sin pasar por el chat). */
export function generateReport(orgId: string, payload: GenerateReportRequest): Promise<GenerateReportResult> {
  return backendFetch(`/v1/assistant/reports?org_id=${orgId}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------------------
// StatsBomb
// ---------------------------------------------------------------------------

/**
 * Dispara el entrenamiento de TODOS los modelos StatsBomb
 * (POST /v1/statsbomb/train/all?org_id=…).
 * Devuelve la lista de resultados por modelo.
 */
export function trainStatsBombModels(orgId: string): Promise<
  Array<{ model_name: string; status: string; metrics?: Record<string, unknown> }>
> {
  return backendFetch(`/v1/statsbomb/train/all?org_id=${orgId}`, { method: 'POST' });
}

/**
 * Dispara la ingesta de StatsBomb Open Data para una competición/temporada
 * concretas, o todas si no se especifica (POST /v1/statsbomb/ingest?org_id=…).
 */
export function ingestStatsBomb(
  orgId: string,
  competitionId?: number,
  seasonId?: number,
): Promise<{ status: string; matches_loaded: number; events_loaded: number }> {
  const params = new URLSearchParams({ org_id: orgId });
  if (competitionId != null) params.set('competition_id', String(competitionId));
  if (seasonId != null) params.set('season_id', String(seasonId));
  return backendFetch(`/v1/statsbomb/ingest?${params.toString()}`, { method: 'POST' });
}

// ---------------------------------------------------------------------------
// Simulación IA
// ---------------------------------------------------------------------------

export interface XgParams {
  location_x: number;
  location_y: number;
  body_part?: string;
  under_pressure?: boolean;
  shot_type?: string;
}

export interface XgResult {
  xg: number;
  xg_percent: number;
  distance_yards: number;
  distance_m: number;
  zone: string;
  angle_degrees?: number;
  source?: string;
  multipliers: Record<string, number>;
}

/** fetch público contra atlos-backend (sin auth) para endpoints que no la requieren. */
export async function backendFetchPublic<T>(path: string, init?: RequestInit): Promise<T> {
  const backendUrl = getBackendUrl();
  if (!backendUrl) throw new Error('VITE_API_URL no está configurado.');
  let response: Response;
  try {
    response = await fetchWithWakeRetry(`${backendUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new Error(unreachableMessage(backendUrl));
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? `El backend respondió ${response.status}.`);
  }
  return response.json();
}

/** Calcula el xG situacional para una posición de tiro en el campo.
 * POST /v1/simulation/xg — no requiere autenticación */
export function computeSituationalXg(params: XgParams): Promise<XgResult> {
  return backendFetchPublic('/v1/simulation/xg', { method: 'POST', body: JSON.stringify(params) });
}

export interface PlayAction {
  type: string;
  from_x: number;
  from_y: number;
  to_x: number;
  to_y: number;
  under_pressure?: boolean;
}

export interface SimulatePlayAction {
  step: number;
  type: string;
  success_probability: number;
  cumulative_probability: number;
  distance_m?: number;
  xg?: number;
  xg_percent?: number;
  zone?: string;
}

export interface SimulatePlayResult {
  total_actions: number;
  sequence_success_probability: number;
  sequence_success_percent: number;
  final_xg: number | null;
  actions: SimulatePlayAction[];
}

/** Simula una secuencia de acciones (pases, conducciones, tiros) y devuelve
 * la probabilidad de éxito de cada acción y el xG final si aplica.
 * POST /v1/simulation/play */
/** POST /v1/simulation/play — no requiere autenticación */
export function simulatePlay(sequence: PlayAction[]): Promise<SimulatePlayResult> {
  return backendFetchPublic('/v1/simulation/play', { method: 'POST', body: JSON.stringify({ sequence }) });
}

/** Sugiere el 11 ideal de un equipo (o de toda la org si team_id es null),
 * respetando la formación. POST /v1/simulation/best-xi?org_id=… */
export function suggestBestXi(
  orgId: string,
  teamId?: string | null,
  formation = '4-3-3',
): Promise<TrainingResult> {
  const params = new URLSearchParams({ org_id: orgId, formation });
  if (teamId) params.set('team_id', teamId);
  return backendFetch(`/v1/simulation/best-xi?${params.toString()}`, { method: 'POST' });
}

export interface SimulateMatchResult {
  home_team: { id: string; name: string; strength: { attack: number; defense: number; squad_size: number } };
  away_team: { id: string; name: string; strength: { attack: number; defense: number; squad_size: number } };
  expected_goals: { home: number; away: number };
  probabilities: { home_win: number; draw: number; away_win: number };
  most_likely_scores: Array<{ score: string; probability: number }>;
  predicted_score: string;
  n_simulations: number;
}

/** Simula un enfrentamiento entre dos equipos de la organización (Poisson).
 * POST /v1/simulation/match?org_id=… */
export function simulateMatch(
  orgId: string,
  homeTeamId: string,
  awayTeamId: string,
  homeAdvantage = 1.15,
): Promise<SimulateMatchResult> {
  return backendFetch(`/v1/simulation/match?org_id=${orgId}`, {
    method: 'POST',
    body: JSON.stringify({ home_team_id: homeTeamId, away_team_id: awayTeamId, home_advantage: homeAdvantage }),
  });
}

// ---------------------------------------------------------------------------
// Perfiles tipo FIFA de jugadores de StatsBomb
// ---------------------------------------------------------------------------

export interface SbPlayerAttributes {
  RIT: number;
  TIR: number;
  PAS: number;
  REG: number;
  DEF: number;
  FIS: number;
}

export interface SbPlayerCard {
  player_id: number;
  name: string;
  country: string | null;
  overall: number;
  matches: number;
  attributes: SbPlayerAttributes;
}

export interface SbPlayerProfile extends SbPlayerCard {
  radar: Array<{ attribute: string; value: number }>;
  stats: Record<string, number>;
  basis: string;
}

export interface SbProfileList {
  total: number;
  players: SbPlayerCard[];
  basis: string;
}

/** Lista de tarjetas de jugador StatsBomb. GET /v1/statsbomb/profiles */
export function listSbProfiles(params: {
  limit?: number;
  offset?: number;
  search?: string;
  sortBy?: string;
}): Promise<SbProfileList> {
  const q = new URLSearchParams();
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.offset != null) q.set('offset', String(params.offset));
  if (params.search) q.set('search', params.search);
  if (params.sortBy) q.set('sort_by', params.sortBy);
  return backendFetch(`/v1/statsbomb/profiles?${q.toString()}`);
}

/** Ficha completa de un jugador StatsBomb. GET /v1/statsbomb/profiles/{id} */
export function getSbProfile(playerId: number): Promise<SbPlayerProfile> {
  return backendFetch(`/v1/statsbomb/profiles/${playerId}`);
}


// ---------------------------------------------------------------------------
// Scouting con IA (recomendación de fichajes sobre el pool de StatsBomb)
// ---------------------------------------------------------------------------

export interface ScoutingCandidate extends SbPlayerCard {
  fit: number;
  style_match: number;
  reason: string;
}

export interface ScoutingResult {
  position: string;
  style: string;
  target: Record<string, number>;
  candidates: ScoutingCandidate[];
  basis: string;
  inferred_style?: string;
  style_inferred_from_team?: boolean;
}

export type ScoutPosition = 'GK' | 'DEF' | 'MID' | 'FWD';
export type ScoutStyle =
  | 'posesion'
  | 'presion'
  | 'contragolpe'
  | 'ofensivo'
  | 'defensivo'
  | 'equilibrado';

/** Recomienda jugadores por posición y estilo. GET /v1/scouting/recommend */
export function scoutingRecommend(params: {
  position: ScoutPosition;
  style: ScoutStyle;
  limit?: number;
  minOverall?: number;
  search?: string;
}): Promise<ScoutingResult> {
  const q = new URLSearchParams({ position: params.position, style: params.style });
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.minOverall != null) q.set('min_overall', String(params.minOverall));
  if (params.search) q.set('search', params.search);
  return backendFetch(`/v1/scouting/recommend?${q.toString()}`);
}

/** Recomienda para el equipo propio (estilo inferido si no se pasa).
 * GET /v1/scouting/recommend-for-team?org_id=… */
export function scoutingRecommendForTeam(params: {
  orgId: string;
  position: ScoutPosition;
  style?: ScoutStyle;
  limit?: number;
}): Promise<ScoutingResult> {
  const q = new URLSearchParams({ org_id: params.orgId, position: params.position });
  if (params.style) q.set('style', params.style);
  if (params.limit != null) q.set('limit', String(params.limit));
  return backendFetch(`/v1/scouting/recommend-for-team?${q.toString()}`);
}


// ---------------------------------------------------------------------------
// Insights — resumen agregado que evita queries masivas desde el navegador
// ---------------------------------------------------------------------------

export interface InsightsSummary {
  counts: {
    players: number;
    sessions: number;
    videos: number;
    predictions_total: number;
    predictions_30d: number;
    models: number;
    active_alerts: number;
  };
  distribution: Array<{ name: string; value: number }>;
  recent_models: Array<{
    name: string;
    version: string;
    task: string;
    metrics: Record<string, unknown>;
    trained_at: string;
  }>;
  recent_activity: Array<{
    prediction_type: string;
    label: string;
    created_at: string;
  }>;
  avg_accuracy: number | null;
}

/** Resumen para Dashboard y AI Center. GET /v1/insights/summary?org_id= */
export function fetchInsightsSummary(orgId: string): Promise<InsightsSummary> {
  return backendFetch(`/v1/insights/summary?org_id=${orgId}`);
}

export interface ForecastEntry {
  player_id: string;
  player_name: string;
  position: string;
  injury_risk: number | null;
  injury_label: string | null;
  fatigue_risk: number | null;
  fatigue_label: string | null;
  proj_goals_next5: number | null;
  proj_assists_next5: number | null;
  top_scorer_proba: number | null;
}

export interface ForecastsResult {
  forecasts: ForecastEntry[];
  summary: {
    players_with_forecast: number;
    high_injury_risk: number;
    high_fatigue_risk: number;
    projected_goals_next5: number;
  };
}

/** Pronósticos por jugador (riesgo lesión/fatiga). GET /v1/insights/forecasts?org_id= */
export function fetchForecasts(orgId: string): Promise<ForecastsResult> {
  return backendFetch(`/v1/insights/forecasts?org_id=${orgId}`);
}


// ---------------------------------------------------------------------------
// Rivales — scouting de equipos rivales y simulación contra ellos
// ---------------------------------------------------------------------------

export type RivalStyle = ScoutStyle;

export interface Rival {
  id: string;
  org_id: string;
  name: string;
  competition: string | null;
  play_style: RivalStyle;
  attack_rating: number | null;
  defense_rating: number | null;
  notes: string | null;
}

export interface RivalInput {
  name: string;
  competition?: string | null;
  play_style: RivalStyle;
  attack_rating?: number | null;
  defense_rating?: number | null;
  notes?: string | null;
}

/** Lista los rivales de la org. GET /v1/rivals?org_id= */
export function listRivals(orgId: string): Promise<Rival[]> {
  return backendFetch(`/v1/rivals?org_id=${orgId}`);
}

/** Crea un rival. POST /v1/rivals?org_id= */
export function createRival(orgId: string, rival: RivalInput): Promise<Rival> {
  return backendFetch(`/v1/rivals?org_id=${orgId}`, { method: 'POST', body: JSON.stringify(rival) });
}

/** Elimina un rival. DELETE /v1/rivals/{id}?org_id= */
export function deleteRival(orgId: string, rivalId: string): Promise<{ deleted: string }> {
  return backendFetch(`/v1/rivals/${rivalId}?org_id=${orgId}`, { method: 'DELETE' });
}

/** Simula equipo propio vs rival. POST /v1/rivals/simulate?org_id= */
export function simulateVsRival(
  orgId: string,
  homeTeamId: string,
  rivalId: string,
  homeAdvantage = 1.15,
): Promise<SimulateMatchResult> {
  return backendFetch(`/v1/rivals/simulate?org_id=${orgId}`, {
    method: 'POST',
    body: JSON.stringify({ home_team_id: homeTeamId, rival_id: rivalId, home_advantage: homeAdvantage }),
  });
}


// ---------------------------------------------------------------------------
// Rating de jugadores propios (overall + atributos) — equivalente FIFA propio
// ---------------------------------------------------------------------------

export interface OwnPlayerRating {
  player_id: string;
  name: string;
  position: string | null;
  overall: number;
  attributes: { RIT: number; RES: number; ACE: number; TIR: number; CRE: number; DIS: number };
}

export interface RatingAttributeExplanation {
  code: string;
  label: string;
  rating: number;
  percentile: number;
  rank_in_squad: number;
  squad_size: number;
  formula: string;
  sources: Array<{ label: string; value: number | null; unit: string }>;
}

export interface OwnPlayerRatingProfile extends OwnPlayerRating {
  radar: Array<{ attribute: string; value: number }>;
  explanation: {
    attributes: RatingAttributeExplanation[];
    overall: number;
    overall_formula: string;
    note: string;
  };
  basis: string;
}

/** Lista ratings de los jugadores propios. GET /v1/player-ratings?org_id= */
export function listOwnPlayerRatings(orgId: string, teamId?: string): Promise<{ players: OwnPlayerRating[]; basis: string }> {
  const q = new URLSearchParams({ org_id: orgId });
  if (teamId) q.set('team_id', teamId);
  return backendFetch(`/v1/player-ratings?${q.toString()}`);
}

/** Ficha de rating de un jugador propio. GET /v1/player-ratings/{id}?org_id= */
export function getOwnPlayerRating(orgId: string, playerId: string): Promise<OwnPlayerRatingProfile> {
  return backendFetch(`/v1/player-ratings/${playerId}?org_id=${orgId}`);
}