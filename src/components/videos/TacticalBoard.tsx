import { useMemo, useState } from 'react';
import { ArrowLeftRight, Flame, Route, UserCheck, Users, X, Zap } from 'lucide-react';

import {
  buildHeatmapDataUrl,
  cumulativeDistanceFractions,
  FIELD_LENGTH_M,
  FIELD_WIDTH_M,
  PitchMarkings,
  toPitch,
  type TrajectoryPoint,
} from '@/components/charts/SoccerPitchMap';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import type { VideoPlayerTrack } from '@/types/domain';

/** Zonas por franja horizontal de la cancha (fracción 0..1 del eje X del video). */
const ZONES = [
  { key: 'portero', label: 'Portero', from: 0, to: 0.14 },
  { key: 'defensa', label: 'Defensa', from: 0.14, to: 0.38 },
  { key: 'medio', label: 'Medio', from: 0.38, to: 0.62 },
  { key: 'delantero', label: 'Delantero', from: 0.62, to: 1.0 },
] as const;

type ZoneKey = (typeof ZONES)[number]['key'];

/** Misma clave que `BALL_TRAJECTORY_KEY` en video_service.py — la pelota
 * viaja en el mismo `trajectories` que los jugadores, pero no es una
 * identidad asignable: se excluye de marcadores/densidad/roster. */
const BALL_TRAJECTORY_KEY = 'ball';

/**
 * Media móvil chica sobre la velocidad ya derivada — mismo objetivo que el
 * filtro Savitzky-Golay que usa `LaurieOnTracking` (no confundir jitter de
 * detección/homografía con aceleración real).
 *
 * IMPORTANTE — no alcanza para detección de sprints: se probó con datos
 * reales (dos videos ya procesados, ~16 y ~47 tracks) clasificar tramos
 * como "sprint" por umbral de velocidad (>=25.2 km/h sostenido) y el
 * resultado fue que 65-100% de la distancia de CASI TODOS los tracks
 * caía en esa banda — fisiológicamente imposible. Ni resampleando a
 * ventanas de hasta 5 segundos (mucho más agresivo que este suavizado)
 * bajó de ~16-21%. Conclusión: la precisión posicional actual del
 * pipeline (homografía + detección YOLO sobre video casero) no alcanza
 * para clasificar movimiento por banda de velocidad de forma confiable —
 * no es un problema de suavizado, es un techo de precisión de los datos
 * de entrada. Por eso NO se construyó una feature de "sprints"/"distancia
 * por intensidad" sobre esto — mostrar esos números sería fabricar una
 * confianza que los datos no tienen. Este suavizado se mantiene solo
 * porque mejora un poco al gráfico de velocidad existente, no porque
 * resuelva el problema de fondo.
 */
function smoothSpeedSeries(
  series: { t: number; speedKmh: number }[],
  halfWindow = 1,
): { t: number; speedKmh: number }[] {
  return series.map((point, i) => {
    const lo = Math.max(0, i - halfWindow);
    const hi = Math.min(series.length, i + halfWindow + 1);
    const window = series.slice(lo, hi);
    const avg = window.reduce((sum, p) => sum + p.speedKmh, 0) / window.length;
    return { t: point.t, speedKmh: avg };
  });
}

export interface RosterOption {
  id: string;
  full_name: string;
  position: string | null;
}

type TeamLabel = 'A' | 'B';

/**
 * Embedding cilíndrico de HSV para agrupar por color (no RGB euclídeo): el
 * matiz (H) se proyecta a un plano (S·cos H, S·sin H) — así la distancia
 * respeta que el matiz es circular (rojo cerca de rojo-violeta) y el propio
 * peso de la saturación hace que un matiz ruidoso en colores casi grises
 * (poca saturación: blanco/negro/gris) no domine la distancia. El brillo
 * (V) pesa menos (`VALUE_WEIGHT`) a propósito: sombras/iluminación distinta
 * entre cámaras afectan sobre todo a V, no deberían separar dos camisetas
 * del mismo color real. Antes esto se hacía con distancia euclídea directa
 * en RGB, más sensible a esos cambios de luz.
 */
type ColorVec = [number, number, number];
const VALUE_WEIGHT = 0.5;

function hexToRgbBytes(hex: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    else h = 60 * ((rn - gn) / delta + 4);
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : delta / max;
  return [h, s, max];
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return [(rp + m) * 255, (gp + m) * 255, (bp + m) * 255];
}

function hexToColorVec(hex: string): ColorVec | null {
  const rgb = hexToRgbBytes(hex);
  if (!rgb) return null;
  const [h, s, v] = rgbToHsv(...rgb);
  const angle = (h * Math.PI) / 180;
  return [s * Math.cos(angle), s * Math.sin(angle), v * VALUE_WEIGHT];
}

function colorVecToHex([x, y, vw]: ColorVec): string {
  const s = Math.min(1, Math.hypot(x, y));
  const h = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const v = Math.min(1, Math.max(0, vw / VALUE_WEIGHT));
  const [r, g, b] = hsvToRgb(h, s, v);
  const channel = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/**
 * Clasifica la posición libre del roster (texto sin formato fijo — viene de
 * CSVs reales, "Defender", "CB", "Mediocampista"...) a la misma zona que ya
 * usa el tablero para las posiciones en cancha. Si el texto no matchea
 * ningún patrón conocido, devuelve null — nunca se adivina a la fuerza.
 */
const ZONE_KEYWORDS: Record<ZoneKey, RegExp> = {
  portero: /\b(portero|goalkeeper|goalie|keeper|arquero|gk)\b/i,
  defensa: /\b(defensa|defender|zaguero|back|centre-back|center-back|fullback|cb|lb|rb)\b/i,
  medio: /\b(medio|mediocampista|mediocampo|volante|midfielder|cm|dm|am)\b/i,
  delantero: /\b(delantero|forward|striker|atacante|extremo|cf|st)\b/i,
};

function positionToZone(position: string | null): ZoneKey | null {
  if (!position) return null;
  for (const zone of ZONES) {
    if (ZONE_KEYWORDS[zone.key].test(position)) return zone.key;
  }
  return null;
}

function colorVecDistance(a: ColorVec, b: ColorVec): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function meanColorVec(colors: ColorVec[]): ColorVec {
  const sum = colors.reduce<ColorVec>((acc, c) => [acc[0] + c[0], acc[1] + c[1], acc[2] + c[2]], [0, 0, 0]);
  return [sum[0] / colors.length, sum[1] / colors.length, sum[2] / colors.length];
}

/**
 * Agrupa las identidades en 2 equipos por color medio de camiseta (k-means
 * simple en el espacio HSV de arriba, semillas = el par de colores más
 * distantes). Requiere >= 2 tracks con shirt_color; si el video es muy
 * casero y el modelo no acumuló color para casi nadie, devuelve un mapa
 * vacío — el tablero simplemente no muestra el filtro de equipo, no
 * inventa una agrupación con datos insuficientes.
 */
function clusterTeams(tracks: VideoPlayerTrack[]): Map<string, TeamLabel> {
  const colored = tracks
    .map((track) => ({
      trackId: String(track.track_id),
      color: track.shirt_color ? hexToColorVec(track.shirt_color) : null,
    }))
    .filter((entry): entry is { trackId: string; color: ColorVec } => entry.color !== null);

  if (colored.length < 2) return new Map();

  let seedA = colored[0].color;
  let seedB = colored[1].color;
  let maxDist = -1;
  for (let i = 0; i < colored.length; i += 1) {
    for (let j = i + 1; j < colored.length; j += 1) {
      const d = colorVecDistance(colored[i].color, colored[j].color);
      if (d > maxDist) {
        maxDist = d;
        seedA = colored[i].color;
        seedB = colored[j].color;
      }
    }
  }

  let centroidA = seedA;
  let centroidB = seedB;
  let labels = new Map<string, TeamLabel>();

  for (let iteration = 0; iteration < 10; iteration += 1) {
    labels = new Map();
    for (const entry of colored) {
      labels.set(
        entry.trackId,
        colorVecDistance(entry.color, centroidA) <= colorVecDistance(entry.color, centroidB) ? 'A' : 'B',
      );
    }
    const groupA = colored.filter((entry) => labels.get(entry.trackId) === 'A').map((entry) => entry.color);
    const groupB = colored.filter((entry) => labels.get(entry.trackId) === 'B').map((entry) => entry.color);
    if (groupA.length > 0) centroidA = meanColorVec(groupA);
    if (groupB.length > 0) centroidB = meanColorVec(groupB);
  }

  return labels;
}

type Point2 = { x: number; y: number };

/** Casco convexo (Andrew's monotone chain) — para "Forma del equipo": el
 * polígono más chico que contiene todas las posiciones registradas de un
 * equipo, usado como aproximación honesta de la amplitud/compactación. */
function convexHull(points: Point2[]): Point2[] {
  if (points.length < 3) return points;
  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const cross = (o: Point2, a: Point2, b: Point2) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: Point2[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point2[] = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

const PITCH_BACKGROUND = 'linear-gradient(180deg, #14532d, #0f3d24)';
const HOLO_BLUE = '#3b82f6';
const HOLO_GREEN = '#22c55e';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/**
 * Figura holográfica de jugador (silueta + base proyectora + líneas de
 * escaneo). Se dibuja con los pies en (0,0) para poder usarla estática
 * (translate) o montada en un <animateMotion> recorriendo la trayectoria.
 */
function HologramFigure({
  variant,
  label,
  dimmed = false,
  selected = false,
}: {
  variant: 'assigned' | 'unassigned';
  label: string;
  dimmed?: boolean;
  selected?: boolean;
}) {
  const color = variant === 'assigned' ? HOLO_GREEN : HOLO_BLUE;
  return (
    <g
      opacity={dimmed ? 0.16 : 1}
      style={dimmed ? undefined : { filter: `drop-shadow(0 0 1.4px ${color})` }}
    >
      {/* Base proyectora */}
      <ellipse cx={0} cy={0} rx={2.4} ry={0.8} fill={color} opacity={0.3}>
        {!dimmed && <animate attributeName="opacity" values="0.18;0.45;0.18" dur="2.2s" repeatCount="indefinite" />}
      </ellipse>
      <ellipse cx={0} cy={0} rx={1.3} ry={0.42} fill={color} opacity={0.55} />

      {/* Silueta (cabeza + torso + piernas) con gradiente de holograma */}
      <g fill={`url(#holo-${variant})`}>
        <circle cx={0} cy={-4.7} r={0.95} />
        <path d="M -1.35 -3.55 Q 0 -4.2 1.35 -3.55 L 0.95 -1.9 L 0.75 -1.9 L 0.75 0 L 0.25 0 L 0.25 -1.1 L -0.25 -1.1 L -0.25 0 L -0.75 0 L -0.75 -1.9 L -0.95 -1.9 Z" />
      </g>

      {/* Líneas de escaneo */}
      {!dimmed && (
        <g stroke="#ffffff" strokeWidth={0.08} opacity={0.45}>
          <line x1={-1.2} y1={-3.2} x2={1.2} y2={-3.2} />
          <line x1={-1.05} y1={-2.4} x2={1.05} y2={-2.4} />
          <line x1={-0.85} y1={-1.5} x2={0.85} y2={-1.5}>
            <animate attributeName="y1" values="-1.5;-4.4;-1.5" dur="3s" repeatCount="indefinite" />
            <animate attributeName="y2" values="-1.5;-4.4;-1.5" dur="3s" repeatCount="indefinite" />
          </line>
        </g>
      )}

      {selected && (
        <ellipse cx={0} cy={0} rx={3.3} ry={1.15} fill="none" stroke="#ffffff" strokeWidth={0.28} className="animate-pulse" />
      )}

      {!dimmed && (
        <text y={1.9} textAnchor="middle" fontSize={1.8} fontWeight={700} fill="#ffffff">
          {label}
        </text>
      )}
    </g>
  );
}

function PanelShell({
  icon: Icon,
  title,
  subtitle,
  accent,
  children,
}: {
  icon: typeof Flame;
  title: string;
  subtitle: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-subtle transition-all duration-200 hover:border-ai/30">
      <div className="mb-3 flex items-center gap-2.5">
        <span className={`flex size-7 items-center justify-center rounded-md ${accent}`}>
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        <div className="leading-tight">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground">{title}</p>
          <p className="text-[10px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

/** Velocidad instantánea del jugador seleccionado a lo largo del video —
 * mismo cálculo (distancia/tiempo entre puntos consecutivos de la
 * trayectoria ya limpiada en el backend) que ya se usaba para el p95 de la
 * tabla, suavizada con una media móvil chica — ver `smoothSpeedSeries` para
 * el límite real de esto (no alcanza para clasificar por banda de
 * velocidad de forma confiable, solo para aliviar el gráfico). */
function SpeedChart({ series }: { series: { t: number; speedKmh: number }[] }) {
  if (series.length < 2) {
    return <p className="py-9 text-center text-xs text-muted-foreground">Sin suficientes datos de velocidad.</p>;
  }
  const width = 300;
  const height = 100;
  const maxSpeed = Math.max(...series.map((s) => s.speedKmh), 10);
  const minT = series[0].t;
  const spanT = Math.max(series[series.length - 1].t - minT, 0.1);
  const toX = (t: number) => ((t - minT) / spanT) * width;
  const toY = (speed: number) => height - (speed / maxSpeed) * height;
  const linePoints = series.map((s) => `${toX(s.t).toFixed(1)},${toY(s.speedKmh).toFixed(1)}`).join(' ');
  const areaPoints = `0,${height} ${linePoints} ${width},${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: 130 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="speed-area-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.55} />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#speed-area-gradient)" />
      <polyline points={linePoints} fill="none" stroke="#3b82f6" strokeWidth={1.4} strokeLinejoin="round" />
      <text x={2} y={9} fontSize={8} fill="rgba(255,255,255,0.55)">
        {maxSpeed.toFixed(0)} km/h
      </text>
      <text x={2} y={height - 3} fontSize={8} fill="rgba(255,255,255,0.55)">
        0
      </text>
    </svg>
  );
}

/** Distancia recorrida por el jugador seleccionado, desglosada por zona
 * (de cancha o de intensidad, según qué lista de zonas se le pase). */
function ZoneDistanceBars({ zones }: { zones: { key: string; label: string; distanceM: number }[] }) {
  const total = zones.reduce((sum, z) => sum + z.distanceM, 0);
  if (total === 0) {
    return <p className="py-9 text-center text-xs text-muted-foreground">Sin suficiente recorrido para desglosar.</p>;
  }
  const maxDistance = Math.max(...zones.map((z) => z.distanceM), 1);
  return (
    <div className="space-y-2.5 py-1">
      {zones.map((zone) => (
        <div key={zone.key} className="flex items-center gap-2 text-xs">
          <span className="w-16 shrink-0 text-muted-foreground">{zone.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full bg-ai" style={{ width: `${(zone.distanceM / maxDistance) * 100}%` }} />
          </div>
          <span className="w-14 shrink-0 text-right tabular-nums text-foreground">{zone.distanceM.toFixed(0)}m</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Tablero táctico: dos canchas gemelas conectadas por la misma selección.
 * Izquierda = mapa de calor (densidad de posiciones reales); derecha =
 * movimiento capturado (marcadores por identidad + trayectoria animada a
 * velocidad real). Seleccionar una identidad enfoca AMBAS canchas, y desde
 * la derecha se asignan las lecturas a jugadores del roster
 * (matched_player_id) — individual o por zona.
 */
export function TacticalBoard({
  trajectories,
  tracks,
  players,
  canEdit,
  isSaving,
  onAssign,
}: {
  trajectories: Record<string, TrajectoryPoint[]>;
  tracks: VideoPlayerTrack[];
  players: RosterOption[];
  canEdit: boolean;
  isSaving: boolean;
  onAssign: (trackIds: number[], playerId: string | null) => Promise<void>;
}) {
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [activeZone, setActiveZone] = useState<ZoneKey | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [teamFilter, setTeamFilter] = useState<TeamLabel | null>(null);

  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const assignmentByTrack = useMemo(
    () => new Map(tracks.map((track) => [String(track.track_id), track.matched_player_id ?? null])),
    [tracks],
  );
  const trackColorById = useMemo(
    () => new Map(tracks.map((track) => [String(track.track_id), track.shirt_color ?? null])),
    [tracks],
  );

  /** Agrupación por color de camiseta (sugerencia 1) — vacío si no hay
   * suficientes tracks con color muestreado; el filtro de equipo no se
   * muestra en ese caso. */
  const teamClusters = useMemo(() => clusterTeams(tracks), [tracks]);
  const teamSwatches = useMemo(() => {
    const groups: Record<TeamLabel, ColorVec[]> = { A: [], B: [] };
    for (const track of tracks) {
      const label = teamClusters.get(String(track.track_id));
      const color = track.shirt_color ? hexToColorVec(track.shirt_color) : null;
      if (label && color) groups[label].push(color);
    }
    return {
      A: groups.A.length > 0 ? colorVecToHex(meanColorVec(groups.A)) : null,
      B: groups.B.length > 0 ? colorVecToHex(meanColorVec(groups.B)) : null,
    };
  }, [tracks, teamClusters]);

  /** Trayectorias con la inversión de lados aplicada (afecta a ambas canchas por igual). */
  const displayTrajectories = useMemo(() => {
    if (!isFlipped) return trajectories;
    return Object.fromEntries(
      Object.entries(trajectories).map(([trackId, points]) => [
        trackId,
        points.map((point) => ({ ...point, x: 1 - point.x })),
      ]),
    );
  }, [trajectories, isFlipped]);

  const markers = useMemo(() => {
    return Object.entries(displayTrajectories)
      .filter(([trackId]) => trackId !== BALL_TRAJECTORY_KEY)
      .map(([trackId, points]) => {
        if (points.length === 0) return null;
        const avgX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const avgY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
        return { trackId, x: avgX, y: avgY, matchedPlayerId: assignmentByTrack.get(trackId) ?? null };
      })
      .filter((marker): marker is NonNullable<typeof marker> => marker !== null);
  }, [displayTrajectories, assignmentByTrack]);

  /** Marcadores visibles en el tablero derecho y base para la asignación por
   * zona — respeta el filtro de equipo (sugerencia 1) sin afectar el
   * selector de "Identidad", que siempre lista todas las identidades. */
  const visibleMarkers = useMemo(() => {
    if (!teamFilter) return markers;
    return markers.filter((marker) => teamClusters.get(marker.trackId) === teamFilter);
  }, [markers, teamFilter, teamClusters]);

  const densityPoints = useMemo(() => {
    if (selectedTrackId) return (displayTrajectories[selectedTrackId] ?? []).map(toPitch);
    const visibleIds = new Set(visibleMarkers.map((m) => m.trackId));
    return Object.entries(displayTrajectories)
      .filter(([trackId]) => trackId !== BALL_TRAJECTORY_KEY && (!teamFilter || visibleIds.has(trackId)))
      .flatMap(([, points]) => points.map(toPitch));
  }, [displayTrajectories, selectedTrackId, visibleMarkers, teamFilter]);

  /** Densidad real (blobs acumulados + colorización por intensidad), no
   * puntos sueltos superpuestos — ver `buildHeatmapDataUrl`. Es densidad de
   * JUGADORES, la pelota queda afuera a propósito (es otro concepto). */
  const heatmapDataUrl = useMemo(() => buildHeatmapDataUrl(densityPoints), [densityPoints]);

  /** Recorrido de la pelota — siempre visible en "Movimiento capturado"
   * (no depende de seleccionar una identidad), con huecos ya interpolados
   * por el backend cuando eran cortos (ver `_interpolate_ball_positions`). */
  const ballPath = useMemo(() => {
    const raw = displayTrajectories[BALL_TRAJECTORY_KEY];
    if (!raw || raw.length < 2) return null;
    const points = raw.map(toPitch);
    const pathD = `M ${points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L ')}`;
    const last = points[points.length - 1];
    return { pathD, last };
  }, [displayTrajectories]);

  const trackPath = useMemo(() => {
    if (!selectedTrackId) return null;
    const raw = displayTrajectories[selectedTrackId];
    if (!raw || raw.length < 2) return null;
    const points = raw.map(toPitch);
    const pathD = `M ${points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L ')}`;
    const keyPoints = cumulativeDistanceFractions(points).join(';');
    const t0 = raw[0].t;
    const span = Math.max(raw[raw.length - 1].t - t0, 0.1);
    const keyTimes = raw.map((p) => ((p.t - t0) / span).toFixed(4)).join(';');
    return { pathD, keyPoints, keyTimes, durationS: Math.min(Math.max(span, 3), 14) };
  }, [displayTrajectories, selectedTrackId]);

  /** Velocidad instantánea de la identidad seleccionada, punto a punto —
   * misma trayectoria ya limpiada por el backend (ver
   * `_filter_trajectory_jumps`), suavizada con una media móvil chica para
   * no confundir jitter residual con aceleración real (ver
   * `smoothSpeedSeries`) antes de exponerla como serie de tiempo. */
  const speedSeries = useMemo(() => {
    if (!selectedTrackId) return [];
    const raw = displayTrajectories[selectedTrackId];
    if (!raw || raw.length < 2) return [];
    const points = raw.map(toPitch);
    const series: { t: number; speedKmh: number }[] = [];
    for (let i = 1; i < points.length; i += 1) {
      const dt = raw[i].t - raw[i - 1].t;
      if (dt <= 0) continue;
      const dist = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      series.push({ t: raw[i].t, speedKmh: (dist / dt) * 3.6 });
    }
    return smoothSpeedSeries(series);
  }, [displayTrajectories, selectedTrackId]);

  /** Distancia recorrida por la identidad seleccionada, atribuida a la zona
   * donde estaba parada en cada tramo (mismas franjas que ya usan los
   * botones de asignación por zona). */
  const zoneDistances = useMemo(() => {
    const base = ZONES.map((zone) => ({ key: zone.key, label: zone.label, distanceM: 0 }));
    if (!selectedTrackId) return base;
    const raw = displayTrajectories[selectedTrackId];
    if (!raw || raw.length < 2) return base;
    const points = raw.map(toPitch);
    const totals = new Map<ZoneKey, number>(ZONES.map((z) => [z.key, 0]));
    for (let i = 1; i < points.length; i += 1) {
      const dist = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      const zone = ZONES.find((z) => raw[i].x >= z.from && raw[i].x < z.to) ?? ZONES[ZONES.length - 1];
      totals.set(zone.key, (totals.get(zone.key) ?? 0) + dist);
    }
    return ZONES.map((zone) => ({ key: zone.key, label: zone.label, distanceM: totals.get(zone.key) ?? 0 }));
  }, [displayTrajectories, selectedTrackId]);

  /** Forma del equipo: centro de gravedad + casco convexo sobre TODAS las
   * posiciones registradas de cada equipo en toda la corrida (no depende
   * de seleccionar una identidad) — requiere que el clustering por color
   * haya encontrado ambos equipos (ver `clusterTeams`). */
  const teamShapes = useMemo(() => {
    if (!teamSwatches.A && !teamSwatches.B) return [];
    const shapes: { label: TeamLabel; color: string; centroid: Point2; hull: Point2[] }[] = [];
    for (const label of ['A', 'B'] as const) {
      const color = teamSwatches[label];
      if (!color) continue;
      const points = Object.entries(displayTrajectories)
        .filter(([trackId]) => trackId !== BALL_TRAJECTORY_KEY && teamClusters.get(trackId) === label)
        .flatMap(([, pts]) => pts.map(toPitch));
      if (points.length < 3) continue;
      const centroid = {
        x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
        y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
      };
      shapes.push({ label, color, centroid, hull: convexHull(points) });
    }
    return shapes;
  }, [displayTrajectories, teamClusters, teamSwatches]);

  const zoneTrackIds = useMemo(() => {
    if (!activeZone) return [];
    const zone = ZONES.find((z) => z.key === activeZone);
    if (!zone) return [];
    return visibleMarkers.filter((m) => m.x >= zone.from && m.x < zone.to).map((m) => Number(m.trackId));
  }, [activeZone, visibleMarkers]);

  const assignedGroups = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const [trackId, playerId] of assignmentByTrack) {
      if (!playerId) continue;
      groups.set(playerId, [...(groups.get(playerId) ?? []), trackId]);
    }
    return [...groups.entries()];
  }, [assignmentByTrack]);

  const selectedAssignment = selectedTrackId ? assignmentByTrack.get(selectedTrackId) ?? null : null;
  const selectedPlayer = playerById.get(selectedPlayerId);
  const zoneLabel = ZONES.find((z) => z.key === activeZone)?.label;

  /** Sugerencia 2: zona dominante del track seleccionado (misma franja que
   * usan los botones de asignación por zona) cruzada con la posición del
   * roster — solo jugadores sin tracks asignados todavía en este video. */
  const dominantZone = useMemo(() => {
    if (!selectedTrackId) return null;
    const marker = markers.find((m) => m.trackId === selectedTrackId);
    if (!marker) return null;
    return ZONES.find((z) => marker.x >= z.from && marker.x < z.to)?.key ?? null;
  }, [selectedTrackId, markers]);

  const suggestedPlayers = useMemo(() => {
    if (!dominantZone) return [];
    const alreadyAssigned = new Set(assignedGroups.map(([playerId]) => playerId));
    return players.filter(
      (player) => !alreadyAssigned.has(player.id) && positionToZone(player.position) === dominantZone,
    );
  }, [dominantZone, players, assignedGroups]);

  return (
    <div>
      {/* Barra de control compartida por ambas canchas */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select
          value={selectedTrackId ?? '__all__'}
          onValueChange={(value) => setSelectedTrackId(value === '__all__' ? null : value)}
        >
          <SelectTrigger className="h-9 w-56">
            <SelectValue placeholder="Identidad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas las identidades</SelectItem>
            {markers.map((marker) => {
              const assigned = marker.matchedPlayerId ? playerById.get(marker.matchedPlayerId) : null;
              const color = trackColorById.get(marker.trackId);
              return (
                <SelectItem key={marker.trackId} value={marker.trackId}>
                  {color && (
                    <span
                      className="mr-1.5 inline-block size-2 rounded-full align-middle"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                  )}
                  J{marker.trackId}
                  {assigned ? ` · ${assigned.full_name}` : ''}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        <Button size="sm" variant="ghost" onClick={() => setIsFlipped((v) => !v)}>
          <ArrowLeftRight className="size-4" aria-hidden="true" /> Invertir lados
        </Button>

        {(teamSwatches.A || teamSwatches.B) && (
          <>
            <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
            {(['A', 'B'] as const).map((label) =>
              teamSwatches[label] ? (
                <Button
                  key={label}
                  size="sm"
                  variant={teamFilter === label ? 'primary' : 'secondary'}
                  onClick={() => setTeamFilter((current) => (current === label ? null : label))}
                >
                  <span
                    className="size-2.5 rounded-full border border-white/30"
                    style={{ backgroundColor: teamSwatches[label] ?? undefined }}
                    aria-hidden="true"
                  />
                  Equipo {label}
                </Button>
              ) : null,
            )}
          </>
        )}

        {canEdit && (
          <>
            <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
            <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
              <SelectTrigger className="h-9 w-56">
                <SelectValue placeholder="Jugador del roster…" />
              </SelectTrigger>
              <SelectContent>
                {players.map((player) => (
                  <SelectItem key={player.id} value={player.id}>
                    {player.full_name}
                    {player.position ? ` · ${player.position}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {ZONES.map((zone) => (
              <Button
                key={zone.key}
                size="sm"
                variant={activeZone === zone.key ? 'primary' : 'secondary'}
                onClick={() => setActiveZone((current) => (current === zone.key ? null : zone.key))}
              >
                {zone.label}
              </Button>
            ))}

            {selectedTrackId && selectedPlayer && (
              <Button size="sm" isLoading={isSaving} onClick={() => onAssign([Number(selectedTrackId)], selectedPlayerId)}>
                <UserCheck className="size-4" aria-hidden="true" /> Asignar J{selectedTrackId} a {initials(selectedPlayer.full_name)}
              </Button>
            )}
            {activeZone && selectedPlayer && zoneTrackIds.length > 0 && (
              <Button size="sm" variant="secondary" isLoading={isSaving} onClick={() => onAssign(zoneTrackIds, selectedPlayerId)}>
                <UserCheck className="size-4" aria-hidden="true" /> Asignar {zoneTrackIds.length} de {zoneLabel?.toLowerCase()}
              </Button>
            )}
            {selectedTrackId && selectedAssignment && (
              <Button size="sm" variant="ghost" isLoading={isSaving} onClick={() => onAssign([Number(selectedTrackId)], null)}>
                <X className="size-4" aria-hidden="true" /> Quitar J{selectedTrackId}
              </Button>
            )}
          </>
        )}
      </div>

      {canEdit && selectedTrackId && !selectedAssignment && suggestedPlayers.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">
            Sugerido por posición ({ZONES.find((z) => z.key === dominantZone)?.label?.toLowerCase()}):
          </span>
          {suggestedPlayers.map((player) => (
            <button
              key={player.id}
              type="button"
              className="focus-ring rounded-full border border-ai/40 bg-ai/10 px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-ai/20"
              onClick={() => setSelectedPlayerId(player.id)}
            >
              {player.full_name}
            </button>
          ))}
        </div>
      )}

      {/* Canchas gemelas — mismo viewBox, misma altura, simetría total */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PanelShell
          icon={Flame}
          title="Mapa de calor"
          subtitle={
            selectedTrackId
              ? `Densidad de J${selectedTrackId}`
              : teamFilter
                ? `Densidad del equipo ${teamFilter}`
                : 'Densidad de todas las identidades'
          }
          accent="bg-warning/15 text-warning"
        >
          <svg
            viewBox={`-2 -2 ${FIELD_LENGTH_M + 4} ${FIELD_WIDTH_M + 4}`}
            className="w-full rounded-lg border border-border"
            style={{ background: PITCH_BACKGROUND }}
          >
            <PitchMarkings />
            {heatmapDataUrl ? (
              <image
                href={heatmapDataUrl}
                x={0}
                y={0}
                width={FIELD_LENGTH_M}
                height={FIELD_WIDTH_M}
                style={{ mixBlendMode: 'screen' }}
                preserveAspectRatio="none"
              />
            ) : (
              <text x={FIELD_LENGTH_M / 2} y={FIELD_WIDTH_M / 2} textAnchor="middle" fontSize={4} fill="rgba(255,255,255,0.5)">
                Sin datos suficientes para el mapa de calor
              </text>
            )}
          </svg>
        </PanelShell>

        <PanelShell
          icon={Route}
          title="Movimiento capturado"
          subtitle={
            selectedTrackId
              ? `Recorrido real de J${selectedTrackId} a velocidad del video`
              : teamFilter
                ? `Mostrando equipo ${teamFilter} — toca una identidad para animar su recorrido`
                : 'Toca una identidad para animar su recorrido'
          }
          accent="bg-ai/15 text-ai"
        >
          <svg
            viewBox={`-2 -2 ${FIELD_LENGTH_M + 4} ${FIELD_WIDTH_M + 4}`}
            className="w-full rounded-lg border border-border"
            style={{ background: PITCH_BACKGROUND }}
          >
            <defs>
              <linearGradient id="holo-unassigned" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={HOLO_BLUE} stopOpacity={0.95} />
                <stop offset="100%" stopColor={HOLO_BLUE} stopOpacity={0.3} />
              </linearGradient>
              <linearGradient id="holo-assigned" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={HOLO_GREEN} stopOpacity={0.95} />
                <stop offset="100%" stopColor={HOLO_GREEN} stopOpacity={0.3} />
              </linearGradient>
            </defs>

            <PitchMarkings />

            {/* Recorrido de la pelota — siempre visible, no es una identidad
                asignable (ver BALL_TRAJECTORY_KEY). Huecos cortos ya
                interpolados por el backend. */}
            {ballPath && (
              <>
                <path
                  d={ballPath.pathD}
                  stroke="#ffffff"
                  strokeWidth={0.35}
                  strokeDasharray="1.2 1"
                  fill="none"
                  opacity={0.55}
                  strokeLinecap="round"
                />
                <circle
                  cx={ballPath.last.x}
                  cy={ballPath.last.y}
                  r={0.9}
                  fill="#ffffff"
                  opacity={0.9}
                  style={{ filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.8))' }}
                />
              </>
            )}

            {activeZone &&
              (() => {
                const zone = ZONES.find((z) => z.key === activeZone);
                if (!zone) return null;
                return (
                  <rect
                    x={zone.from * FIELD_LENGTH_M}
                    y={0}
                    width={(zone.to - zone.from) * FIELD_LENGTH_M}
                    height={FIELD_WIDTH_M}
                    fill="#3b82f6"
                    opacity={0.15}
                  />
                );
              })()}

            {trackPath && (
              <path d={trackPath.pathD} stroke={HOLO_BLUE} strokeWidth={0.5} fill="none" opacity={0.45} strokeLinecap="round" />
            )}

            {/* Fichas estáticas: hologramas. Con una identidad seleccionada,
                las demás quedan como fantasmas para despejar la vista; la
                seleccionada no se pinta estática porque su holograma viaja
                por la trayectoria (abajo). */}
            {visibleMarkers.map((marker) => {
              const assigned = marker.matchedPlayerId ? playerById.get(marker.matchedPlayerId) : null;
              const isSelected = marker.trackId === selectedTrackId;
              if (isSelected && trackPath) return null;
              return (
                <g
                  key={marker.trackId}
                  transform={`translate(${marker.x * FIELD_LENGTH_M}, ${marker.y * FIELD_WIDTH_M})`}
                  onClick={() => setSelectedTrackId((current) => (current === marker.trackId ? null : marker.trackId))}
                  className="cursor-pointer"
                  role="button"
                  aria-label={`Identidad J${marker.trackId}${assigned ? ` asignada a ${assigned.full_name}` : ''}`}
                >
                  <HologramFigure
                    variant={assigned ? 'assigned' : 'unassigned'}
                    label={assigned ? initials(assigned.full_name) : String(marker.trackId)}
                    dimmed={selectedTrackId !== null && !isSelected}
                    selected={isSelected}
                  />
                </g>
              );
            })}

            {/* Holograma en movimiento: recorre la trayectoria real a la velocidad del video */}
            {trackPath && selectedTrackId && (
              <g>
                <animateMotion
                  path={trackPath.pathD}
                  dur={`${trackPath.durationS}s`}
                  repeatCount="indefinite"
                  keyPoints={trackPath.keyPoints}
                  keyTimes={trackPath.keyTimes}
                  calcMode="linear"
                />
                <HologramFigure
                  variant={selectedAssignment ? 'assigned' : 'unassigned'}
                  label={
                    selectedAssignment
                      ? initials(playerById.get(selectedAssignment)?.full_name ?? '')
                      : selectedTrackId
                  }
                  selected
                />
              </g>
            )}
          </svg>
        </PanelShell>
      </div>

      {/* Forma del equipo — centro de gravedad + amplitud, promedio de toda
          la corrida. No depende de seleccionar una identidad. */}
      <div className="mt-4">
        <PanelShell
          icon={Users}
          title="Forma del equipo"
          subtitle="Centro de gravedad y amplitud — promedio de toda la corrida"
          accent="bg-purple/15 text-purple"
        >
          {teamShapes.length > 0 ? (
            <svg
              viewBox={`-2 -2 ${FIELD_LENGTH_M + 4} ${FIELD_WIDTH_M + 4}`}
              className="w-full rounded-lg border border-border"
              style={{ background: PITCH_BACKGROUND, maxHeight: 260 }}
            >
              <PitchMarkings />
              {teamShapes.map((shape) => (
                <g key={shape.label}>
                  <polygon
                    points={shape.hull.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')}
                    fill={shape.color}
                    opacity={0.16}
                    stroke={shape.color}
                    strokeWidth={0.4}
                    strokeOpacity={0.7}
                  />
                  <circle
                    cx={shape.centroid.x}
                    cy={shape.centroid.y}
                    r={1.4}
                    fill={shape.color}
                    style={{ filter: `drop-shadow(0 0 3px ${shape.color})` }}
                  />
                  <text
                    x={shape.centroid.x}
                    y={shape.centroid.y - 2.6}
                    textAnchor="middle"
                    fontSize={3.2}
                    fontWeight={700}
                    fill={shape.color}
                  >
                    Equipo {shape.label}
                  </text>
                </g>
              ))}
            </svg>
          ) : (
            <p className="py-9 text-center text-xs text-muted-foreground">
              Todavía no hay suficientes camisetas identificadas para agrupar los dos equipos.
            </p>
          )}
        </PanelShell>
      </div>

      {/* Velocidad en el tiempo + distancia por zona/intensidad — solo
          tienen sentido para una identidad puntual, no para "todas". */}
      {selectedTrackId && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PanelShell
            icon={Zap}
            title="Velocidad en el tiempo"
            subtitle={`Velocidad instantánea de J${selectedTrackId}`}
            accent="bg-ai/15 text-ai"
          >
            <SpeedChart series={speedSeries} />
          </PanelShell>
          <PanelShell
            icon={Route}
            title="Distancia por zona"
            subtitle={`Dónde recorrió sus metros J${selectedTrackId}`}
            accent="bg-success/15 text-success"
          >
            <ZoneDistanceBars zones={zoneDistances} />
          </PanelShell>
        </div>
      )}

      {assignedGroups.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {assignedGroups.map(([playerId, trackIds]) => {
            const player = playerById.get(playerId);
            return (
              <div key={playerId} className="flex flex-wrap items-center gap-2 rounded-md bg-panel px-3 py-2 text-sm">
                <Badge variant="success">{player?.full_name ?? 'Jugador'}</Badge>
                <span className="text-xs text-muted-foreground">
                  {trackIds.length} identidad(es): {trackIds.map((id) => `J${id}`).join(', ')}
                </span>
                {canEdit && (
                  <button
                    type="button"
                    className="focus-ring ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:text-danger"
                    onClick={() => onAssign(trackIds.map(Number), null)}
                  >
                    <X className="size-3" aria-hidden="true" /> Quitar todas
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
