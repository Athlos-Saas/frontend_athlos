import { useMemo } from 'react';

export interface TrajectoryPoint {
  x: number; // normalizado 0..1 (ancho del frame)
  y: number; // normalizado 0..1 (alto del frame)
  t: number; // segundos desde el inicio del video
}

export const FIELD_LENGTH_M = 105;
export const FIELD_WIDTH_M = 68;

export function toPitch(point: TrajectoryPoint): { x: number; y: number } {
  return { x: point.x * FIELD_LENGTH_M, y: point.y * FIELD_WIDTH_M };
}

/** Fracciones acumuladas de distancia real recorrida (para que `keyPoints` de la animación respete el ritmo real, no uniforme). */
export function cumulativeDistanceFractions(points: { x: number; y: number }[]): number[] {
  const distances = [0];
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    distances.push(total);
  }
  if (total === 0) return points.map((_, i) => i / Math.max(1, points.length - 1));
  return distances.map((d) => d / total);
}

// --- Mapa de calor real (densidad por acumulación de "blobs" gaussianos) ---
// Antes esto era solo puntos translúcidos superpuestos (sin ningún cálculo
// de densidad) — con pocas identidades o posiciones ruidosas se veía como
// una nube de puntos, no como un mapa de calor. Esta versión acumula un
// blob suave por punto en un canvas offscreen (composite "lighter", el
// mismo truco que usa heatmap.js) y despues coloriza por intensidad
// relativa al pico real de esta corrida — nunca un valor hardcodeado.
const HEATMAP_CANVAS_SCALE = 6; // px por metro de cancha
const HEATMAP_BLOB_RADIUS_M = 3.2; // "radio de influencia" de cada posición, en metros
const HEATMAP_COLOR_STOPS: Array<[number, [number, number, number, number]]> = [
  [0.0, [0, 0, 0, 0]],
  [0.25, [37, 99, 235, 140]], // azul
  [0.5, [34, 197, 94, 190]], // verde
  [0.75, [250, 204, 21, 215]], // amarillo
  [1.0, [239, 68, 68, 240]], // rojo
];

function buildHeatmapColorRamp(): Uint8ClampedArray {
  const ramp = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i += 1) {
    const t = i / 255;
    let lower = HEATMAP_COLOR_STOPS[0];
    let upper = HEATMAP_COLOR_STOPS[HEATMAP_COLOR_STOPS.length - 1];
    for (let s = 0; s < HEATMAP_COLOR_STOPS.length - 1; s += 1) {
      if (t >= HEATMAP_COLOR_STOPS[s][0] && t <= HEATMAP_COLOR_STOPS[s + 1][0]) {
        lower = HEATMAP_COLOR_STOPS[s];
        upper = HEATMAP_COLOR_STOPS[s + 1];
        break;
      }
    }
    const span = upper[0] - lower[0] || 1;
    const localT = (t - lower[0]) / span;
    for (let c = 0; c < 4; c += 1) {
      ramp[i * 4 + c] = lower[1][c] + (upper[1][c] - lower[1][c]) * localT;
    }
  }
  return ramp;
}

/**
 * Genera un data URL PNG con el mapa de calor real de `points` (ya en
 * metros de cancha, ver `toPitch`). Devuelve `null` si no hay puntos —
 * nunca dibuja un heatmap vacío como si hubiera datos.
 */
export function buildHeatmapDataUrl(points: Array<{ x: number; y: number }>): string | null {
  if (points.length === 0) return null;
  if (typeof document === 'undefined') return null;

  const width = Math.round(FIELD_LENGTH_M * HEATMAP_CANVAS_SCALE);
  const height = Math.round(FIELD_WIDTH_M * HEATMAP_CANVAS_SCALE);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const radiusPx = HEATMAP_BLOB_RADIUS_M * HEATMAP_CANVAS_SCALE;
  ctx.globalCompositeOperation = 'lighter';
  for (const point of points) {
    const cx = point.x * HEATMAP_CANVAS_SCALE;
    const cy = point.y * HEATMAP_CANVAS_SCALE;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radiusPx);
    gradient.addColorStop(0, 'rgba(255,255,255,0.30)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
    ctx.fill();
  }

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  let max = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > max) max = data[i];
  }
  if (max === 0) return null;

  const ramp = buildHeatmapColorRamp();
  for (let i = 0; i < data.length; i += 4) {
    const intensity = data[i + 3];
    if (intensity === 0) continue;
    const bucket = Math.min(255, Math.round((intensity / max) * 255));
    data[i] = ramp[bucket * 4];
    data[i + 1] = ramp[bucket * 4 + 1];
    data[i + 2] = ramp[bucket * 4 + 2];
    data[i + 3] = ramp[bucket * 4 + 3];
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

export function PitchMarkings() {
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
