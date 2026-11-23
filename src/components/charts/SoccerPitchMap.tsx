import { useId, useMemo } from 'react';

import { DEFAULT_SPORT, getSportConfig, SPORTS, type SportFieldDimensions, type SportKey } from '@/constants/sports';
import { colors, fieldColors } from '@/constants/tokens';

export interface TrajectoryPoint {
  x: number; // normalizado 0..1 (ancho del frame)
  y: number; // normalizado 0..1 (alto del frame)
  t: number; // segundos desde el inicio del video
}

// Se mantienen exportadas por retrocompatibilidad (LiveMatchMap y otros las
// importan). La fuente es ahora constants/sports.ts: estas son las de fútbol.
export const FIELD_LENGTH_M = SPORTS.soccer.field.lengthM;
export const FIELD_WIDTH_M = SPORTS.soccer.field.widthM;

/** Dimensiones del campo para un deporte (default fútbol). */
export function fieldDimensions(sport: SportKey | string | null | undefined = DEFAULT_SPORT): SportFieldDimensions {
  return getSportConfig(sport).field;
}

/**
 * Convención de coordenadas compartida por TODOS los diagramas de campo
 * (este, LiveMatchMap, PassNetworkChart): x = largo (de arco a arco) hacia la
 * derecha, y = ancho con 0 ARRIBA, igual que el SVG sin transform. Es la misma
 * orientación con la que el pipeline proyecta desde píxeles (y crece hacia
 * abajo en la imagen). No invertir y: el espejo vertical ya apareció dos veces
 * (ver CLAUDE.md del backend y HeatmapGrid en MatchInsights).
 */
export function toField(point: TrajectoryPoint, sport?: SportKey | string | null): { x: number; y: number } {
  const { lengthM, widthM } = fieldDimensions(sport);
  return { x: point.x * lengthM, y: point.y * widthM };
}

/**
 * Versión fútbol de `toField`, con UN solo parámetro a propósito: se usa como
 * `points.map(toPitch)` en LiveMatchMap/TacticalBoard, y un segundo parámetro
 * opcional recibiría el índice del map como si fuera el deporte.
 */
export function toPitch(point: TrajectoryPoint): { x: number; y: number } {
  return toField(point, DEFAULT_SPORT);
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
export function buildHeatmapDataUrl(
  points: Array<{ x: number; y: number }>,
  sport?: SportKey | string | null,
): string | null {
  if (points.length === 0) return null;
  if (typeof document === 'undefined') return null;

  const { lengthM, widthM } = fieldDimensions(sport);
  const width = Math.round(lengthM * HEATMAP_CANVAS_SCALE);
  const height = Math.round(widthM * HEATMAP_CANVAS_SCALE);
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

// ---------------------------------------------------------------- Marcas
// Cada deporte dibuja sus líneas en metros reales dentro de un rect de
// (lengthM x widthM). Las medidas son reglamentarias (FIFA, FIBA, World Rugby);
// si cambian las dimensiones en constants/sports.ts, las marcas se ubican
// relativas al nuevo tamaño en vez de quedar en posiciones absolutas.

function SoccerMarkings({ lengthM: L, widthM: W }: SportFieldDimensions) {
  return (
    <>
      <rect x={0} y={0} width={L} height={W} />
      <line x1={L / 2} y1={0} x2={L / 2} y2={W} />
      <circle cx={L / 2} cy={W / 2} r={9.15} />
      <circle cx={L / 2} cy={W / 2} r={0.4} fill={fieldColors.line} />
      {/* áreas y arcos de penal, izquierda y derecha */}
      <rect x={0} y={(W - 40.3) / 2} width={16.5} height={40.3} />
      <rect x={L - 16.5} y={(W - 40.3) / 2} width={16.5} height={40.3} />
      <rect x={0} y={(W - 18.32) / 2} width={5.5} height={18.32} />
      <rect x={L - 5.5} y={(W - 18.32) / 2} width={5.5} height={18.32} />
      <circle cx={11} cy={W / 2} r={0.4} fill={fieldColors.line} />
      <circle cx={L - 11} cy={W / 2} r={0.4} fill={fieldColors.line} />
    </>
  );
}

// FIBA: aro a 1.575 m de la línea de fondo, triple a 6.75 m (0.9 m de la banda
// en las esquinas), zona de 5.8 x 4.9 m, círculos de 1.8 m, semicírculo de no
// carga de 1.25 m.
const FIBA_HOOP_X = 1.575;
const FIBA_THREE_R = 6.75;
const FIBA_CORNER_Y = 0.9;
const FIBA_KEY_LENGTH = 5.8;
const FIBA_KEY_WIDTH = 4.9;
const FIBA_CIRCLE_R = 1.8;
const FIBA_NO_CHARGE_R = 1.25;

function BasketballMarkings({ lengthM: L, widthM: W }: SportFieldDimensions) {
  const cy = W / 2;
  // x donde la recta de esquina del triple se une con el arco.
  const cornerDy = cy - FIBA_CORNER_Y;
  const joinX = FIBA_HOOP_X + Math.sqrt(Math.max(0, FIBA_THREE_R ** 2 - cornerDy ** 2));
  const half = (side: 'left' | 'right') => {
    // Lado derecho = espejo horizontal (x -> L - x), con el arco en sentido
    // contrario. El eje y NO se toca (misma convención que el resto).
    const mx = (x: number) => (side === 'left' ? x : L - x);
    const sweep = side === 'left' ? 1 : 0;
    return (
      <g key={side}>
        <path
          d={`M ${mx(0)} ${FIBA_CORNER_Y} L ${mx(joinX)} ${FIBA_CORNER_Y} A ${FIBA_THREE_R} ${FIBA_THREE_R} 0 0 ${sweep} ${mx(joinX)} ${W - FIBA_CORNER_Y} L ${mx(0)} ${W - FIBA_CORNER_Y}`}
        />
        <rect
          x={side === 'left' ? 0 : L - FIBA_KEY_LENGTH}
          y={cy - FIBA_KEY_WIDTH / 2}
          width={FIBA_KEY_LENGTH}
          height={FIBA_KEY_WIDTH}
        />
        <circle cx={mx(FIBA_KEY_LENGTH)} cy={cy} r={FIBA_CIRCLE_R} />
        <path
          d={`M ${mx(FIBA_HOOP_X)} ${cy - FIBA_NO_CHARGE_R} A ${FIBA_NO_CHARGE_R} ${FIBA_NO_CHARGE_R} 0 0 ${sweep} ${mx(FIBA_HOOP_X)} ${cy + FIBA_NO_CHARGE_R}`}
        />
        {/* tablero (1.8 m, a 1.2 m del fondo) y aro (Ø 0.45 m) */}
        <line x1={mx(1.2)} y1={cy - 0.9} x2={mx(1.2)} y2={cy + 0.9} stroke={fieldColors.lineStrong} />
        <circle cx={mx(FIBA_HOOP_X)} cy={cy} r={0.225} stroke={fieldColors.lineStrong} />
      </g>
    );
  };
  return (
    <>
      <rect x={0} y={0} width={L} height={W} />
      <line x1={L / 2} y1={0} x2={L / 2} y2={W} />
      <circle cx={L / 2} cy={cy} r={FIBA_CIRCLE_R} />
      {half('left')}
      {half('right')}
    </>
  );
}

// Rugby union: líneas de 22 m sólidas, de 10 m (desde la mitad) y de 5 m
// (desde el try) discontinuas, y las de 5 m/15 m paralelas a la banda.
// Postes con 5.6 m de separación sobre la línea de try.
const RUGBY_POST_HALF_GAP = 2.8;

function RugbyMarkings({ lengthM: L, widthM: W }: SportFieldDimensions) {
  const dashed = { strokeDasharray: '1.2 1.2' };
  return (
    <>
      <rect x={0} y={0} width={L} height={W} />
      <line x1={L / 2} y1={0} x2={L / 2} y2={W} />
      <line x1={22} y1={0} x2={22} y2={W} />
      <line x1={L - 22} y1={0} x2={L - 22} y2={W} />
      <line x1={L / 2 - 10} y1={0} x2={L / 2 - 10} y2={W} {...dashed} />
      <line x1={L / 2 + 10} y1={0} x2={L / 2 + 10} y2={W} {...dashed} />
      <line x1={5} y1={0} x2={5} y2={W} {...dashed} />
      <line x1={L - 5} y1={0} x2={L - 5} y2={W} {...dashed} />
      {[5, 15, W - 15, W - 5].map((y) => (
        <line key={y} x1={0} y1={y} x2={L} y2={y} {...dashed} opacity={0.6} />
      ))}
      {[0, L].map((x) => (
        <g key={x} stroke={fieldColors.lineStrong}>
          <circle cx={x} cy={W / 2 - RUGBY_POST_HALF_GAP} r={0.35} />
          <circle cx={x} cy={W / 2 + RUGBY_POST_HALF_GAP} r={0.35} />
        </g>
      ))}
    </>
  );
}

/** Líneas del campo. `sport` opcional: sin él dibuja la cancha de fútbol de
 * siempre (API retrocompatible con `<PitchMarkings />`). */
export function PitchMarkings({ sport = DEFAULT_SPORT }: { sport?: SportKey | string | null } = {}) {
  const config = getSportConfig(sport);
  // El trazo es en metros: 0.35 m en una cancha de 105 se ve como línea fina,
  // en una de 28 sería una franja. Se escala con el largo del campo.
  const strokeWidth = (0.35 * config.field.lengthM) / SPORTS.soccer.field.lengthM;
  return (
    <g stroke={fieldColors.line} strokeWidth={strokeWidth} fill="none">
      {config.key === 'basketball' ? (
        <BasketballMarkings {...config.field} />
      ) : config.key === 'rugby' ? (
        <RugbyMarkings {...config.field} />
      ) : (
        <SoccerMarkings {...config.field} />
      )}
    </g>
  );
}

/**
 * Fondo del campo como <rect> con gradiente DENTRO del SVG (antes era un
 * `background` CSS del <svg>). Así la exportación a PNG lo captura: un fondo
 * CSS no viaja cuando el SVG se serializa como imagen aislada.
 */
export function FieldSurface({
  sport = DEFAULT_SPORT,
  padding = 2,
}: {
  sport?: SportKey | string | null;
  /** Margen alrededor del campo, en metros (el viewBox suele tener -2). */
  padding?: number;
}) {
  // useId devuelve ":r1:"; los dos puntos dentro de url(#...) no resuelven
  // en todos los navegadores, así que se limpian.
  const gradientId = `field-surface-${useId().replace(/:/g, '')}`;
  const config = getSportConfig(sport);
  const [top, bottom] =
    config.surface === 'court'
      ? [fieldColors.courtTop, fieldColors.courtBottom]
      : [fieldColors.grassTop, fieldColors.grassBottom];
  return (
    <>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={top} />
          <stop offset="100%" stopColor={bottom} />
        </linearGradient>
      </defs>
      <rect
        x={-padding}
        y={-padding}
        width={config.field.lengthM + padding * 2}
        height={config.field.widthM + padding * 2}
        fill={`url(#${gradientId})`}
      />
    </>
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
  sport = DEFAULT_SPORT,
}: {
  mode: 'density' | 'track';
  allTrajectories: Record<string, TrajectoryPoint[]>;
  selectedTrackId: string | null;
  /** Deporte del campo (`teams.sport`). Opcional: default fútbol. */
  sport?: SportKey | string | null;
}) {
  const { lengthM, widthM } = fieldDimensions(sport);
  const densityPoints = useMemo(() => {
    if (mode !== 'density') return [];
    return Object.values(allTrajectories).flatMap((points) => points.map((point) => toField(point, sport)));
  }, [mode, allTrajectories, sport]);

  const trackPath = useMemo(() => {
    if (mode !== 'track' || !selectedTrackId) return null;
    const raw = allTrajectories[selectedTrackId];
    if (!raw || raw.length < 2) return null;

    const points = raw.map((point) => toField(point, sport));
    const pathD = `M ${points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L ')}`;
    const keyPoints = cumulativeDistanceFractions(points).join(';');
    const t0 = raw[0].t;
    const tEnd = raw[raw.length - 1].t;
    const span = Math.max(tEnd - t0, 0.1);
    const keyTimes = raw.map((p) => ((p.t - t0) / span).toFixed(4)).join(';');

    return { pathD, keyPoints, keyTimes, durationS: Math.min(Math.max(span, 3), 14) };
  }, [mode, selectedTrackId, allTrajectories, sport]);

  return (
    <svg
      viewBox={`-2 -2 ${lengthM + 4} ${widthM + 4}`}
      className="w-full rounded-lg border border-border"
    >
      <FieldSurface sport={sport} />
      <PitchMarkings sport={sport} />

      {mode === 'density' && (
        <g style={{ mixBlendMode: 'screen' }}>
          {densityPoints.map((point, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <circle key={index} cx={point.x} cy={point.y} r={1.1} fill={colors.orange} opacity={0.14} />
          ))}
        </g>
      )}

      {mode === 'track' && trackPath && (
        <g>
          <path d={trackPath.pathD} stroke={colors.blue} strokeWidth={0.5} fill="none" opacity={0.4} strokeLinecap="round" />
          <circle r={1.6} fill={colors.purple} style={{ filter: `drop-shadow(0 0 3px ${colors.purple})` }}>
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
        <text x={lengthM / 2} y={widthM / 2} textAnchor="middle" fontSize={4} fill={fieldColors.lineStrong}>
          Sin suficientes posiciones para animar
        </text>
      )}
    </svg>
  );
}

/** Alias con nombre neutral (multideporte): mismo componente, acepta `sport`. */
export const PitchMap = SoccerPitchMap;
