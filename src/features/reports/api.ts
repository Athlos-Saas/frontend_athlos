/**
 * Cliente del módulo Reportes.
 *
 * Reparto deliberado:
 * - GENERAR va al backend (POST /v1/reports): arma el PDF con SERVICE_ROLE,
 *   lo sube al bucket `reports` y registra la fila. Gate: roles de escritura.
 * - LISTAR, DESCARGAR y BORRAR van directo a Supabase con la ANON key: la RLS
 *   de `reports` (002) y del bucket `reports` (003) ya dan lectura a cualquier
 *   miembro de la org y borrado solo a admin. Pasar eso por el backend sería
 *   un segundo lugar donde equivocarse con el filtro de organización.
 *
 * Vive aquí y no en `lib/backendApi.ts` porque ese archivo es compartido por
 * varios módulos; de él solo se reutiliza `backendFetch` (sesión + reintento
 * del despertar de Render).
 */
import { backendFetch } from '@/lib/backendApi';
import { supabase } from '@/lib/supabase';

/** Tipos PDF de este módulo (services/report_service.py: REPORT_KINDS). */
export const MODULE_REPORT_TYPES = ['squad_weekly', 'post_match', 'rival_scouting'] as const;
export type ModuleReportType = (typeof MODULE_REPORT_TYPES)[number];

/** Tipos Excel que genera AthlosBot (assistant_report_tool.py): también
 * aparecen en el historial porque comparten tabla y bucket. */
export const ASSISTANT_REPORT_TYPES = ['team_readiness', 'watchlist', 'match_report'] as const;

/** Mismo TTL que el backend; el link se pide de nuevo en cada descarga. */
export const REPORT_SIGNED_URL_TTL_S = 3600;

const REPORTS_BUCKET = 'reports';

export interface ReportRow {
  id: string;
  org_id: string;
  team_id: string | null;
  title: string;
  report_type: string;
  storage_path: string;
  created_by: string | null;
  created_at: string;
  /** Solo si la migración 027 está aplicada. */
  params?: Record<string, unknown> | null;
  file_size_bytes?: number | null;
}

export interface ReportListItem extends ReportRow {
  author_name: string | null;
  file_format: 'pdf' | 'xlsx' | 'other';
}

export interface GenerateModuleReportRequest {
  report_type: ModuleReportType;
  team_id?: string;
  /** AAAA-MM-DD, último día de la semana (squad_weekly). */
  period_end?: string;
  video_id?: string;
  rival_id?: string;
}

export interface GenerateModuleReportResult {
  report_id: string;
  title: string;
  report_type: ModuleReportType;
  storage_path: string;
  download_url: string | null;
  expires_in_seconds: number;
  file_size_bytes: number;
}

export function generateModuleReport(
  orgId: string,
  payload: GenerateModuleReportRequest,
): Promise<GenerateModuleReportResult> {
  return backendFetch(`/v1/reports?org_id=${encodeURIComponent(orgId)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

function fileFormat(path: string): ReportListItem['file_format'] {
  const lower = path.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.xlsx')) return 'xlsx';
  return 'other';
}

/**
 * Historial de la org, más recientes primero. `select('*')` y no una lista de
 * columnas: así la vista funciona antes y después de la migración 027
 * (`params`, `file_size_bytes`) sin romper la consulta.
 */
export async function fetchReports(orgId: string): Promise<ReportListItem[]> {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  const rows = (data ?? []) as ReportRow[];

  // `reports.created_by` apunta a auth.users, no a profiles: sin FK no hay
  // embed de PostgREST, así que los nombres se piden aparte (RLS
  // profiles_select_org deja leer los perfiles de la propia org).
  const authorIds = [...new Set(rows.map((row) => row.created_by).filter((id): id is string => !!id))];
  const names = new Map<string, string | null>();
  if (authorIds.length) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', authorIds);
    if (profilesError) throw profilesError;
    for (const profile of profiles ?? []) names.set(profile.user_id, profile.full_name ?? null);
  }

  return rows.map((row) => ({
    ...row,
    author_name: row.created_by ? (names.get(row.created_by) ?? null) : null,
    file_format: fileFormat(row.storage_path),
  }));
}

export async function createReportDownloadUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(REPORTS_BUCKET)
    .createSignedUrl(storagePath, REPORT_SIGNED_URL_TTL_S);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Supabase no devolvió una URL firmada.');
  return data.signedUrl;
}

/**
 * Borra archivo y fila (solo admin: lo exige la RLS, no esta función). Primero
 * el archivo: si falla, la fila sigue y el usuario puede reintentar; al revés
 * quedaría un PDF huérfano en Storage que ya nadie ve en el historial.
 */
export async function deleteReport(report: Pick<ReportRow, 'id' | 'storage_path'>): Promise<void> {
  const { error: storageError } = await supabase.storage.from(REPORTS_BUCKET).remove([report.storage_path]);
  if (storageError) throw storageError;
  const { error } = await supabase.from('reports').delete().eq('id', report.id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Opciones de los selectores del generador (lectura directa con RLS).
// ---------------------------------------------------------------------------

export interface ReportTeamOption {
  id: string;
  name: string;
  season: string | null;
}

export interface ReportVideoOption {
  id: string;
  title: string;
  match_date: string | null;
  created_at: string;
}

export interface ReportRivalOption {
  id: string;
  name: string;
  competition: string | null;
}

export async function fetchReportTeams(orgId: string): Promise<ReportTeamOption[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, season')
    .eq('org_id', orgId)
    .order('season', { ascending: false })
    .order('name');
  if (error) throw error;
  return data ?? [];
}

/** Solo análisis terminados: el backend rechaza (409) los que no están "done". */
export async function fetchReportVideos(orgId: string): Promise<ReportVideoOption[]> {
  const { data, error } = await supabase
    .from('video_analyses')
    .select('id, title, match_date, created_at')
    .eq('org_id', orgId)
    .eq('status', 'done')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

/**
 * Directo contra la tabla `rivals` (RLS: select para cualquier miembro) y no
 * vía `listRivals` del backend, que exige rol de escritura: así un viewer
 * no recibe un 403 solo por abrir la página.
 */
export async function fetchReportRivals(orgId: string): Promise<ReportRivalOption[]> {
  const { data, error } = await supabase
    .from('rivals')
    .select('id, name, competition')
    .eq('org_id', orgId)
    .order('name');
  if (error) throw error;
  return data ?? [];
}
