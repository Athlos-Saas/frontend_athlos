import { useMemo } from 'react';

import { buildHeatmapDataUrl, FIELD_LENGTH_M, FIELD_WIDTH_M, PitchMarkings, toPitch, type TrajectoryPoint } from '@/components/charts/SoccerPitchMap';

const BALL_TRAJECTORY_KEY = 'ball';

/**
 * Posición interpolada de un track en el instante `time` (segundos desde el
 * inicio del video) — interpola linealmente entre los dos puntos reales más
 * cercanos. Si `time` cae fuera del rango en el que ese track fue detectado
 * (todavía no apareció en cuadro, o ya salió), devuelve `null` — nunca
 * inventa dónde estaría un jugador fuera de lo que la detección real cubrió.
 */
function interpolatePosition(points: TrajectoryPoint[], time: number): { x: number; y: number } | null {
  if (points.length === 0) return null;
  const first = points[0];
  const last = points[points.length - 1];
  if (time < first.t || time > last.t) return null;
  if (points.length === 1) return toPitch(first);

  for (let i = 1; i < points.length; i += 1) {
    if (points[i].t >= time) {
      const a = points[i - 1];
      const b = points[i];
      const span = b.t - a.t || 1;
      const localT = (time - a.t) / span;
      const ax = toPitch(a);
      const bx = toPitch(b);
      return { x: ax.x + (bx.x - ax.x) * localT, y: ax.y + (bx.y - ax.y) * localT };
    }
  }
  return toPitch(last);
}

export interface LiveMatchMapProps {
  trajectories: Record<string, TrajectoryPoint[]>;
  currentTime: number;
  colorByTrackId: Map<string, string>;
  labelByTrackId: Map<string, string>;
  showHeatmap: boolean;
  /** Resalta al jugador más cercano a la pelota en este instante — una aproximación visual de "quién tiene la posesión", no un dato oficial de posesión (no hay ningún sensor/regla que confirme contacto real con la pelota). */
  highlightPossession?: boolean;
}

/**
 * Mapa de posiciones EN VIVO, sincronizado con el `currentTime` del video
 * (lo pasa el caller desde el propio elemento `<video>`, vía `timeupdate`) —
 * a diferencia del recorrido animado de TacticalBoard.tsx (una animación
 * SVG con su propia duración, independiente del video real), acá cada punto
 * se calcula para el instante EXACTO del video que se está reproduciendo.
 */
export function LiveMatchMap({
  trajectories,
  currentTime,
  colorByTrackId,
  labelByTrackId,
  showHeatmap,
  highlightPossession = false,
}: LiveMatchMapProps) {
  const heatmapUrl = useMemo(() => {
    if (!showHeatmap) return null;
    const points = Object.entries(trajectories)
      .filter(([key]) => key !== BALL_TRAJECTORY_KEY)
      .flatMap(([, points]) => points.map(toPitch));
    return buildHeatmapDataUrl(points);
  }, [trajectories, showHeatmap]);

  const livePositions = useMemo(() => {
    return Object.entries(trajectories)
      .map(([trackId, points]) => ({ trackId, position: interpolatePosition(points, currentTime) }))
      .filter((entry): entry is { trackId: string; position: { x: number; y: number } } => entry.position !== null);
  }, [trajectories, currentTime]);

  // Estela del balón: sus posiciones reales de los últimos ~1.2 s, para leer
  // hacia dónde va, no solo un punto quieto. Son puntos MEDIDOS (los mismos de
  // la trayectoria), recortados a la ventana previa a `currentTime` — no se
  // extrapola nada hacia adelante.
  const ballTrail = useMemo(() => {
    const points = trajectories[BALL_TRAJECTORY_KEY];
    if (!points || points.length === 0) return [];
    const windowStart = currentTime - 1.2;
    return points
      .filter((p) => p.t <= currentTime && p.t >= windowStart)
      .map((p) => toPitch(p));
  }, [trajectories, currentTime]);

  const possessionTrackId = useMemo(() => {
    if (!highlightPossession) return null;
    const ballPosition = livePositions.find((entry) => entry.trackId === BALL_TRAJECTORY_KEY)?.position;
    if (!ballPosition) return null;
    let closest: { trackId: string; distance: number } | null = null;
    for (const entry of livePositions) {
      if (entry.trackId === BALL_TRAJECTORY_KEY) continue;
      const distance = Math.hypot(entry.position.x - ballPosition.x, entry.position.y - ballPosition.y);
      if (!closest || distance < closest.distance) closest = { trackId: entry.trackId, distance };
    }
    return closest?.trackId ?? null;
  }, [highlightPossession, livePositions]);

  return (
    <svg
      viewBox={`-2 -2 ${FIELD_LENGTH_M + 4} ${FIELD_WIDTH_M + 4}`}
      className="w-full rounded-lg border border-border"
      style={{ background: 'linear-gradient(180deg, #14532d, #0f3d24)' }}
    >
      <PitchMarkings />
      {heatmapUrl && (
        <image
          href={heatmapUrl}
          x={0}
          y={0}
          width={FIELD_LENGTH_M}
          height={FIELD_WIDTH_M}
          style={{ mixBlendMode: 'screen' }}
          opacity={0.75}
        />
      )}
      {/* Estela del balón: segmentos que se desvanecen hacia el pasado. */}
      {ballTrail.length >= 2 &&
        ballTrail.slice(1).map((point, index) => {
          const previous = ballTrail[index];
          const fade = (index + 1) / ballTrail.length; // 0 (viejo) -> 1 (reciente)
          return (
            <line
              key={`ball-trail-${index}`}
              x1={previous.x}
              y1={previous.y}
              x2={point.x}
              y2={point.y}
              stroke="#fde047"
              strokeWidth={0.35 + 0.5 * fade}
              strokeLinecap="round"
              opacity={0.15 + 0.55 * fade}
            />
          );
        })}
      {livePositions.map(({ trackId, position }) =>
        trackId === BALL_TRAJECTORY_KEY ? (
          <g key={trackId}>
            {/* Halo + punto: el balón blanco chico se perdía sobre el mapa de
             * calor claro; el borde oscuro y el halo lo hacen legible siempre. */}
            <circle cx={position.x} cy={position.y} r={1.15} fill="#fde047" opacity={0.35} />
            <circle
              cx={position.x}
              cy={position.y}
              r={0.7}
              fill="#ffffff"
              stroke="#0b1220"
              strokeWidth={0.22}
            />
          </g>
        ) : (
          <g key={trackId} transform={`translate(${position.x}, ${position.y})`}>
            {trackId === possessionTrackId && <circle r={2.6} fill="none" stroke="#fbbf24" strokeWidth={0.4} opacity={0.9} />}
            <circle r={1.7} fill={colorByTrackId.get(trackId) ?? '#3b82f6'} stroke="#0b1220" strokeWidth={0.25} />
            <text y={-2.4} textAnchor="middle" fontSize={2.4} fill="#ffffff" style={{ paintOrder: 'stroke', stroke: '#0b1220', strokeWidth: 0.5 }}>
              {labelByTrackId.get(trackId) ?? trackId}
            </text>
          </g>
        ),
      )}
    </svg>
  );
}
