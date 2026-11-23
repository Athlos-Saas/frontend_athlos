/**
 * PassNetworkChart — red de pases construida desde `video_events` (nuestro
 * pipeline de video, no StatsBomb).
 *
 * - Nodo = jugador (track del video) en la posición MEDIA donde inició sus
 *   pases. Es la convención de las redes de pase de análisis táctico: dice
 *   desde dónde distribuye cada uno, no dónde estuvo en general (para eso
 *   están los mapas de calor).
 * - Arista = pares que se pasaron la pelota; el grosor es el nº de pases en
 *   ambos sentidos (A→B + B→A). El sentido se conserva en el tooltip y en el
 *   CSV, pero no se dibuja con flechas: con 10+ aristas cruzadas las puntas
 *   ensucian más de lo que informan.
 * - Un receptor que nunca dio un pase no tiene "posición media de inicio";
 *   en vez de descartarlo (y perder las aristas hacia él) se ubica en su
 *   posición media de recepción y se dibuja con borde punteado, para que se
 *   note que esa posición sale de otra medida.
 *
 * Coordenadas: las de SoccerPitchMap/LiveMatchMap — x = largo hacia la
 * derecha, y = ancho con 0 arriba, SIN invertir (ver `toPitch`). El espejo
 * vertical ya apareció dos veces en los mapas del video.
 */
import { useMemo } from 'react';

import { FieldSurface, fieldDimensions, PitchMarkings } from '@/components/charts/SoccerPitchMap';
import { SPORTS, type SportKey } from '@/constants/sports';
import { chartSeriesPalette, colors, fieldColors } from '@/constants/tokens';
import type { VideoEvent } from '@/types/domain';

/**
 * Con 5 pases o menos no hay red: cada arista vale 1 y el gráfico es una lista
 * de líneas sueltas que sugiere una estructura que los datos no tienen. Esos
 * pases ya se ven uno por uno en la tabla de eventos.
 */
export const PASS_NETWORK_MIN_PASSES = 5;

export type PassNetworkTeamFilter = 'all' | 0 | 1;

export interface PassNetworkNode {
  trackId: number;
  x: number;
  y: number;
  team: number | null;
  passesMade: number;
  passesReceived: number;
  positionSource: 'pass_start' | 'reception';
}

export interface PassNetworkEdge {
  /** track_id menor del par (la arista es no dirigida). */
  a: number;
  b: number;
  aToB: number;
  bToA: number;
  count: number;
}

export interface PassNetwork {
  nodes: PassNetworkNode[];
  edges: PassNetworkEdge[];
  passCount: number;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mostCommon(values: number[]): number | null {
  if (values.length === 0) return null;
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((x, y) => y[1] - x[1])[0][0];
}

/**
 * Arma la red a partir de los eventos crudos. Solo cuenta `pass` con emisor,
 * receptor distinto y coordenadas de inicio: un pase sin posición no puede
 * aportar a la posición media y se descarta en vez de imputarle una.
 */
export function buildPassNetwork(
  events: VideoEvent[],
  team: PassNetworkTeamFilter,
  sport: SportKey | string | null = 'soccer',
): PassNetwork {
  const { lengthM, widthM } = fieldDimensions(sport);
  const passes = events.filter((event) => {
    if (event.event_type !== 'pass') return false;
    if (event.track_id == null || event.end_track_id == null || event.track_id === event.end_track_id) return false;
    if (toNumber(event.start_x_m) === null || toNumber(event.start_y_m) === null) return false;
    return team === 'all' || event.team_cluster === team;
  });

  type Acc = { sx: number; sy: number; starts: number; rx: number; ry: number; receptions: number; teams: number[] };
  const acc = new Map<number, Acc>();
  const getAcc = (id: number) => {
    let entry = acc.get(id);
    if (!entry) {
      entry = { sx: 0, sy: 0, starts: 0, rx: 0, ry: 0, receptions: 0, teams: [] };
      acc.set(id, entry);
    }
    return entry;
  };
  const edges = new Map<string, PassNetworkEdge>();

  for (const pass of passes) {
    const from = pass.track_id as number;
    const to = pass.end_track_id as number;
    const sender = getAcc(from);
    // Se recorta CADA punto al campo antes de promediar (no solo el promedio):
    // una proyección degenerada de la homografía (120 m en una cancha de 105)
    // arrastraría la posición media de todo el jugador.
    sender.sx += clamp(toNumber(pass.start_x_m) as number, 0, lengthM);
    sender.sy += clamp(toNumber(pass.start_y_m) as number, 0, widthM);
    sender.starts += 1;
    if (pass.team_cluster != null) sender.teams.push(pass.team_cluster);

    const receiver = getAcc(to);
    const ex = toNumber(pass.end_x_m);
    const ey = toNumber(pass.end_y_m);
    if (ex !== null && ey !== null) {
      receiver.rx += clamp(ex, 0, lengthM);
      receiver.ry += clamp(ey, 0, widthM);
      receiver.receptions += 1;
    }
    const receiverTeam = pass.end_team_cluster ?? pass.team_cluster;
    if (receiverTeam != null) receiver.teams.push(receiverTeam);

    const a = Math.min(from, to);
    const b = Math.max(from, to);
    const key = `${a}-${b}`;
    const edge = edges.get(key) ?? { a, b, aToB: 0, bToA: 0, count: 0 };
    if (from === a) edge.aToB += 1;
    else edge.bToA += 1;
    edge.count += 1;
    edges.set(key, edge);
  }

  const passesMade = new Map<number, number>();
  const passesReceived = new Map<number, number>();
  for (const pass of passes) {
    passesMade.set(pass.track_id as number, (passesMade.get(pass.track_id as number) ?? 0) + 1);
    passesReceived.set(pass.end_track_id as number, (passesReceived.get(pass.end_track_id as number) ?? 0) + 1);
  }

  const nodes: PassNetworkNode[] = [];
  for (const [trackId, entry] of acc) {
    let x: number;
    let y: number;
    let positionSource: PassNetworkNode['positionSource'];
    if (entry.starts > 0) {
      x = entry.sx / entry.starts;
      y = entry.sy / entry.starts;
      positionSource = 'pass_start';
    } else if (entry.receptions > 0) {
      x = entry.rx / entry.receptions;
      y = entry.ry / entry.receptions;
      positionSource = 'reception';
    } else {
      // Sin ninguna coordenada medida: no se inventa una posición.
      continue;
    }
    nodes.push({
      trackId,
      x,
      y,
      team: mostCommon(entry.teams),
      passesMade: passesMade.get(trackId) ?? 0,
      passesReceived: passesReceived.get(trackId) ?? 0,
      positionSource,
    });
  }

  const nodeIds = new Set(nodes.map((node) => node.trackId));
  return {
    nodes,
    edges: [...edges.values()].filter((edge) => nodeIds.has(edge.a) && nodeIds.has(edge.b)),
    passCount: passes.length,
  };
}

export interface PassNetworkChartProps {
  network: PassNetwork;
  /** Deporte del campo; default fútbol. */
  sport?: SportKey | string | null;
  /** Color por equipo (0/1), típicamente el color real de camiseta. */
  teamColors?: Map<number, string>;
  /** Etiqueta visible de un track (nombre del roster si está asignado). */
  labelForTrack?: (trackId: number) => string;
  /** Texto del tooltip de una arista; lo arma el caller para poder traducirlo. */
  edgeTitle?: (edge: PassNetworkEdge) => string;
  nodeTitle?: (node: PassNetworkNode) => string;
  /** Descripción accesible del gráfico (traducida por el caller). */
  ariaLabel?: string;
}

export function PassNetworkChart({
  network,
  sport = 'soccer',
  teamColors,
  labelForTrack = (trackId) => `#${trackId}`,
  edgeTitle,
  nodeTitle,
  ariaLabel,
}: PassNetworkChartProps) {
  const { lengthM, widthM } = fieldDimensions(sport);
  // Tamaños en metros pensados para 105 m de largo; en una cancha de básquet
  // (28 m) los mismos metros taparían media cancha, así que se escalan.
  const k = lengthM / SPORTS.soccer.field.lengthM;

  const nodeById = useMemo(() => new Map(network.nodes.map((node) => [node.trackId, node])), [network.nodes]);
  const maxEdge = useMemo(() => Math.max(1, ...network.edges.map((edge) => edge.count)), [network.edges]);
  const maxInvolvement = useMemo(
    () => Math.max(1, ...network.nodes.map((node) => node.passesMade + node.passesReceived)),
    [network.nodes],
  );
  const sortedEdges = useMemo(() => [...network.edges].sort((x, y) => x.count - y.count), [network.edges]);

  const colorFor = (team: number | null) =>
    team === null ? chartSeriesPalette[1] : teamColors?.get(team) ?? chartSeriesPalette[team === 0 ? 0 : 3];

  return (
    <svg
      viewBox={`-2 -2 ${lengthM + 4} ${widthM + 4}`}
      className="h-full w-full rounded-lg"
      role="img"
      aria-label={ariaLabel}
    >
      <FieldSurface sport={sport} />
      <PitchMarkings sport={sport} />

      <g strokeLinecap="round">
        {sortedEdges.map((edge) => {
          const a = nodeById.get(edge.a);
          const b = nodeById.get(edge.b);
          if (!a || !b) return null;
          const ratio = edge.count / maxEdge;
          return (
            <line
              key={`${edge.a}-${edge.b}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={fieldColors.lineStrong}
              strokeWidth={(0.25 + 1.9 * ratio) * k}
              strokeOpacity={0.35 + 0.55 * ratio}
            >
              {edgeTitle && <title>{edgeTitle(edge)}</title>}
            </line>
          );
        })}
      </g>

      {network.nodes.map((node) => {
        const involvement = (node.passesMade + node.passesReceived) / maxInvolvement;
        const r = (1.3 + 1.9 * Math.sqrt(involvement)) * k;
        return (
          <g key={node.trackId} transform={`translate(${node.x}, ${node.y})`}>
            {nodeTitle && <title>{nodeTitle(node)}</title>}
            <circle
              r={r}
              fill={colorFor(node.team)}
              stroke={fieldColors.ink}
              strokeWidth={0.3 * k}
              strokeDasharray={node.positionSource === 'reception' ? `${0.6 * k} ${0.4 * k}` : undefined}
            />
            <text
              y={-r - 0.8 * k}
              textAnchor="middle"
              fontSize={2.3 * k}
              fill={colors.textPrimary}
              style={{ paintOrder: 'stroke', stroke: fieldColors.ink, strokeWidth: 0.5 * k }}
            >
              {labelForTrack(node.trackId)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
