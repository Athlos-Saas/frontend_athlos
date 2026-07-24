import { supabase } from '@/lib/supabase';
import type { Model3DExtension } from './format';

const BUCKET = 'player-media';
/** Un poco menor al TTL real (6h) para que react-query refresque antes de que expire. */
export const SIGNED_URL_TTL_SECONDS = 60 * 60 * 6;

function imageExtension(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

/** Sube la foto (ya redimensionada/comprimida) al bucket `player-media` y devuelve la ruta guardada en `players.photo_url`. */
export async function uploadPlayerPhoto(orgId: string, playerId: string, blob: Blob): Promise<string> {
  const path = `${orgId}/players/${playerId}/photo.${imageExtension(blob.type)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { upsert: true, contentType: blob.type });
  if (error) throw error;
  return path;
}

/** Sube el modelo 3D tal cual (sin recomprimir) y devuelve la ruta guardada en `players.model_3d_url`. */
export async function uploadPlayerModel(orgId: string, playerId: string, file: File, format: Model3DExtension): Promise<string> {
  const path = `${orgId}/players/${playerId}/model.${format}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
}

/** El bucket es privado (igual que videos/processed/heatmaps/reports) — hay que firmar cada ruta para poder mostrarla. */
export async function getSignedMediaUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) return null;
  return data.signedUrl;
}
