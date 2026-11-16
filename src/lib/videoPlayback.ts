import { supabase } from '@/lib/supabase';

const SIGNED_URL_TTL_SECONDS = 3600;

/**
 * URL firmada del video ORIGINAL (bucket privado `videos`), para usarla cuando
 * el anotado (`processed`) no se puede reproducir.
 *
 * Por qué existe: si ffmpeg falla en el backend, `_transcode_for_browser` sube
 * el archivo de cv2 tal cual, en MPEG-4 Part 2 (`mp4v`), que Chrome/Firefox no
 * decodifican → el <video> dispara `error` y queda en negro. Medido el
 * 2026-11-16: los 3 análisis más recientes de producción estaban así, mientras
 * que todos los originales eran H.264 (`avc1`) y sí se reproducen.
 */
export async function signOriginalVideoUrl(storagePath: string | null | undefined): Promise<string | null> {
  if (!storagePath) return null;
  const { data, error } = await supabase.storage.from('videos').createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error) {
    console.error('[videoPlayback] no se pudo firmar el video original:', error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}
