import { useMemo } from 'react';

export interface TrajectoryPoint {
  x: number; // normalizado 0..1 (ancho del frame)
  y: number; // normalizado 0..1 (alto del frame)
  t: number; // segundos desde el inicio del video
}

const FIELD_LENGTH_M = 105;
const FIELD_WIDTH_M = 68;

function toPitch(point: TrajectoryPoint): { x: number; y: number } {
  return { x: point.x * FIELD_LENGTH_M, y: point.y * FIELD_WIDTH_M };
}

/** Fracciones acumuladas de distancia real recorrida (para que `keyPoints` de la animación respete el ritmo real, no uniforme). */
function cumulativeDistanceFractions(points: { x: number; y: number }[]): number[] {
  const distances = [0];
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    distances.push(total);
  }
  if (total === 0) return points.map((_, i) => i / Math.max(1, points.length - 1));
  return distances.map((d) => d / total);
}

function PitchMarkings() {
  return (
    <g stroke="rgba(255,255,255,0.35)" strokeWidth={0.35} fill="none">
      <rect x={0} y={0} width={FIELD_LENGTH_M} height={FIELD_WIDTH_M} />
      <line x1={FIELD_LENGTH_M / 2} y1={0} x2={FIELD_LENGTH_M / 2} y2={FIELD_WIDTH_M} />
      <circle cx={FIELD_LENGTH_M / 2} cy={FIELD_WIDTH_M / 2} r={9.15} />
      <circle cx={FIELD_LENGTH_M / 2} cy={FIELD_WIDTH_M / 2} r={0.4} fill="rgba(255,255,255,0.35)" />
      {/* áreas y arcos de penal, izquierda y derecha */}
      <rect x={0} y={(FIELD_WIDTH_M - 40.3) / 2} width={16.5} height={40.3} />
      <rect x={FIELD_LENGTH_M - 16.5} y={(FIELD_WIDTH_M - 40.3) / 2} width={16.5} height={40.3} />
      <rect x={0} y={(FIELD_WIDTH_M - 18.32) / 2} width={5.5} height={18.32} />
      <rect x={FIELD_LENGTH_M - 5.5} y={(FIELD_WIDTH_M - 18.32) / 2} width={5.5} height={18.32} />
      <circle cx={11} cy={FIELD_WIDTH_M / 2} r={0.4} fill="rgba(255,255,255,0.35)" />
      <circle cx={FIELD_LENGTH_M - 11} cy={FIELD_WIDTH_M / 2} r={0.4} fill="rgba(255,255,255,0.35)" />
    </g>
  );
}

/**
 * Cancha en SVG (proporciones reales 105x68m) con dos modos:
 * - `density`: puntos translúcidos de TODOS los tracks superpuestos (efecto
 *   mapa de calor real, con mix-blend-mode para que se vea intensidad donde
 *   se repiten posiciones).
 * - `track`: la trayectoria de un jugador específico, animada con velocidad
 *   real (los tiempos `t` de cada punto vienen de la detección real, no se
 *   inventa un recorrido).
 */
export function SoccerPitchMap({
  mode,
  allTrajectories,
  selectedTrackId,
}: {
  mode: 'density' | 'track';
  allTrajectories: Record<string, TrajectoryPoint[]>;
  selectedTrackId: string | null;
}) {
  const densityPoints = useMemo(() => {
    if (mode !== 'density') return [];
    return Object.values(allTrajectories).flatMap((points) => points.map(toPitch));
  }, [mode, allTrajectories]);

  const trackPath = useMemo(() => {
    if (mode !== 'track' || !selectedTrackId) return null;
    const raw = allTrajectories[selectedTrackId];
    if (!raw || raw.length < 2) return null;

    const points = raw.map(toPitch);
    const pathD = `M ${points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L ')}`;
    const keyPoints = cumulativeDistanceFractions(points).join(';');
    const t0 = raw[0].t;
    const tEnd = raw[raw.length - 1].t;
    const span = Math.max(tEnd - t0, 0.1);
    const keyTimes = raw.map((p) => ((p.t - t0) / span).toFixed(4)).join(';');

    return { pathD, keyPoints, keyTimes, durationS: Math.min(Math.max(span, 3), 14) };
  }, [mode, selectedTrackId, allTrajectories]);

  return (
    <svg
      viewBox={`-2 -2 ${FIELD_LENGTH_M + 4} ${FIELD_WIDTH_M + 4}`}
      className="w-full rounded-lg border border-border"
      style={{ background: 'linear-gradient(180deg, #14532d, #0f3d24)' }}
    >
      <PitchMarkings />

      {mode === 'density' && (
        <g style={{ mixBlendMode: 'screen' }}>
          {densityPoints.map((point, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <circle key={index} cx={point.x} cy={point.y} r={1.1} fill="#f59e0b" opacity={0.14} />
          ))}
        </g>
      )}

      {mode === 'track' && trackPath && (
        <g>
          <path d={trackPath.pathD} stroke="#3b82f6" strokeWidth={0.5} fill="none" opacity={0.4} strokeLinecap="round" />
          <circle r={1.6} fill="#7c3aed" style={{ filter: 'drop-shadow(0 0 3px #7c3aed)' }}>
            <animateMotion
              path={trackPath.pathD}
              dur={`${trackPath.durationS}s`}
              repeatCount="indefinite"
              keyPoints={trackPath.keyPoints}
              keyTimes={trackPath.keyTimes}
              calcMode="linear"
            />
          </circle>
        </g>
      )}

      {mode === 'track' && !trackPath && (
        <text x={FIELD_LENGTH_M / 2} y={FIELD_WIDTH_M / 2} textAnchor="middle" fontSize={4} fill="rgba(255,255,255,0.5)">
          Sin suficientes posiciones para animar
        </text>
      )}
    </svg>
  );
}
