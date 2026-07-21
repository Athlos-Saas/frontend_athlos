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
