import type { SpeedComparisonDatum } from '@/components/charts/SpeedComparisonChart';
import type { GpsSession } from '@/types/domain';
import type { PlayerVideoTrack } from './queries';

/**
 * Une sesiones GPS y tracks de video en una sola línea de tiempo por fecha,
 * para comparar la velocidad máxima medida por ambas fuentes. Los tracks de
 * video sin `match_date` (videos subidos sin fecha de partido) se excluyen
 * en vez de ubicarlos con una fecha inventada — se cuentan aparte para que
 * la UI pueda avisarlo.
 */
export function buildSpeedTimeline(
  sessions: GpsSession[],
  videoTracks: PlayerVideoTrack[],
): { timeline: SpeedComparisonDatum[]; videosWithoutDate: number } {
  const byDate = new Map<string, SpeedComparisonDatum>();

  for (const session of sessions) {
    if (session.top_speed_kmh == null) continue;
    const point = byDate.get(session.session_date) ?? { date: session.session_date };
    // Si hay mas de una sesion GPS el mismo dia (doble turno), se toma el
    // pico mas alto entre ellas -- mismo criterio que del lado video.
    point.gps_speed = Math.max(point.gps_speed ?? 0, session.top_speed_kmh);
    byDate.set(session.session_date, point);
  }

  let videosWithoutDate = 0;
  for (const track of videoTracks) {
    if (track.max_speed_kmh == null) continue;
    if (!track.match_date) {
      videosWithoutDate += 1;
      continue;
    }
    const point = byDate.get(track.match_date) ?? { date: track.match_date };
    // Si hay varias lecturas del mismo jugador en el mismo partido, se toma
    // el pico mas alto entre ellas -- es el mejor estimado real de ese dia.
    point.video_speed = Math.max(point.video_speed ?? 0, track.max_speed_kmh);
    byDate.set(track.match_date, point);
  }

  const timeline = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { timeline, videosWithoutDate };
}
