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
    throw new Error(`No se pudo conectar a ${backendUrl}. ¿El backend está corriendo y accesible desde aquí?`);
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
    throw new Error(`No se pudo conectar a ${backendUrl}. ¿El backend está corriendo y accesible desde aquí?`);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? `El backend respondió ${response.status}.`);
  }

  return response.json();
}

/** fetch autenticado genérico contra atlos-backend con la sesión del usuario. */
async function backendFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    throw new Error('VITE_API_URL no está configurado: no hay un backend accesible desde el navegador.');
  }

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No hay sesión activa.');

  let response: Response;
  try {
    response = await fetch(`${backendUrl}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new Error(`No se pudo conectar a ${backendUrl}. ¿El backend está corriendo y accesible desde aquí?`);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? `El backend respondió ${response.status}.`);
  }

  return response.json();
}

// --- Gestión de usuarios (solo admin; el backend valida el rol) ---

export type OrgUserRole = 'admin' | 'coach' | 'medical' | 'analyst' | 'viewer';

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
  payload: { email: string; full_name: string; role: OrgUserRole },
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
  zone: string;
  multipliers: Record<string, number>;
}

/** fetch público contra atlos-backend (sin auth) para endpoints que no la requieren. */
async function backendFetchPublic<T>(path: string, init?: RequestInit): Promise<T> {
  const backendUrl = getBackendUrl();
  if (!backendUrl) throw new Error('VITE_API_URL no está configurado.');
  let response: Response;
  try {
    response = await fetch(`${backendUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new Error(`No se pudo conectar a ${backendUrl}.`);
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

export interface SimulatePlayResult {
  sequence_success_probability: number;
  actions: Array<{
    type: string;
    from_x: number;
    from_y: number;
    to_x: number;
    to_y: number;
    probability: number;
    cumulative_probability: number;
    xg?: number;
  }>;
}

/** Simula una secuencia de acciones (pases, conducciones, tiros) y devuelve
 * la probabilidad de éxito de cada acción y el xG final si aplica.
 * POST /v1/simulation/play */
/** POST /v1/simulation/play — no requiere autenticación */
export function simulatePlay(sequence: PlayAction[]): Promise<SimulatePlayResult> {
  return backendFetchPublic('/v1/simulation/play', { method: 'POST', body: JSON.stringify({ sequence }) });
}

/** Sugiere el 11 ideal para la organización usando los modelos de ML.
 * POST /v1/simulation/best-xi?org_id=… */
export function suggestBestXi(orgId: string): Promise<TrainingResult> {
  return backendFetch(`/v1/simulation/best-xi?org_id=${orgId}`, { method: 'POST' });
}

/** Compara el plantel de la organización contra benchmarks de élite.
 * POST /v1/simulation/benchmark-roster?org_id=… */
export function benchmarkRoster(orgId: string): Promise<TrainingResult> {
  return backendFetch(`/v1/simulation/benchmark-roster?org_id=${orgId}`, { method: 'POST' });
}
