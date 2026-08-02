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
}

/**
 * Mapa de posiciones EN VIVO, sincronizado con el `currentTime` del video
 * (lo pasa el caller desde el propio elemento `<video>`, vía `timeupdate`) —
 * a diferencia del recorrido animado de TacticalBoard.tsx (una animación
 * SVG con su propia duración, independiente del video real), acá cada punto
 * se calcula para el instante EXACTO del video que se está reproduciendo.
 */
export function LiveMatchMap({ trajectories, currentTime, colorByTrackId, labelByTrackId, showHeatmap }: LiveMatchMapProps) {
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
      {livePositions.map(({ trackId, position }) =>
        trackId === BALL_TRAJECTORY_KEY ? (
          <circle key={trackId} cx={position.x} cy={position.y} r={0.75} fill="#ffffff" style={{ filter: 'drop-shadow(0 0 2px #ffffff)' }} />
        ) : (
          <g key={trackId} transform={`translate(${position.x}, ${position.y})`}>
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
