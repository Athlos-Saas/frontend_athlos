import { supabase } from '@/lib/supabase';

export function getBackendUrl(): string | null {
  return import.meta.env.VITE_API_URL ?? null;
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
  kind: 'physical' | 'technical',
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
export async function triggerVideoProcessing(orgId: string, videoId: string): Promise<{ video_id: string; status: string }> {
  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    throw new Error('VITE_API_URL no está configurado: no hay un backend accesible desde el navegador.');
  }

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No hay sesión activa.');

  let response: Response;
  try {
    response = await fetch(`${backendUrl}/v1/videos/${videoId}/process?org_id=${orgId}`, {
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
