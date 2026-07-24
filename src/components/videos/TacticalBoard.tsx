import { useMemo, useState } from 'react';
import { ArrowLeftRight, Flame, Route, UserCheck, X } from 'lucide-react';

import {
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

export interface RosterOption {
  id: string;
  full_name: string;
  position: string | null;
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

  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const assignmentByTrack = useMemo(
    () => new Map(tracks.map((track) => [String(track.track_id), track.matched_player_id ?? null])),
    [tracks],
  );

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
      .map(([trackId, points]) => {
        if (points.length === 0) return null;
        const avgX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const avgY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
        return { trackId, x: avgX, y: avgY, matchedPlayerId: assignmentByTrack.get(trackId) ?? null };
      })
      .filter((marker): marker is NonNullable<typeof marker> => marker !== null);
  }, [displayTrajectories, assignmentByTrack]);

  const densityPoints = useMemo(() => {
    const source = selectedTrackId ? { [selectedTrackId]: displayTrajectories[selectedTrackId] ?? [] } : displayTrajectories;
    return Object.values(source).flatMap((points) => points.map(toPitch));
  }, [displayTrajectories, selectedTrackId]);

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

  const zoneTrackIds = useMemo(() => {
    if (!activeZone) return [];
    const zone = ZONES.find((z) => z.key === activeZone);
    if (!zone) return [];
    return markers.filter((m) => m.x >= zone.from && m.x < zone.to).map((m) => Number(m.trackId));
  }, [activeZone, markers]);

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
              return (
                <SelectItem key={marker.trackId} value={marker.trackId}>
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

      {/* Canchas gemelas — mismo viewBox, misma altura, simetría total */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PanelShell
          icon={Flame}
          title="Mapa de calor"
          subtitle={selectedTrackId ? `Densidad de J${selectedTrackId}` : 'Densidad de todas las identidades'}
          accent="bg-warning/15 text-warning"
        >
          <svg
            viewBox={`-2 -2 ${FIELD_LENGTH_M + 4} ${FIELD_WIDTH_M + 4}`}
            className="w-full rounded-lg border border-border"
            style={{ background: PITCH_BACKGROUND }}
          >
            <PitchMarkings />
            <g style={{ mixBlendMode: 'screen' }}>
              {densityPoints.map((point, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <circle key={index} cx={point.x} cy={point.y} r={1.1} fill="#f59e0b" opacity={0.14} />
              ))}
            </g>
          </svg>
        </PanelShell>

        <PanelShell
          icon={Route}
          title="Movimiento capturado"
          subtitle={
            selectedTrackId
              ? `Recorrido real de J${selectedTrackId} a velocidad del video`
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
            {markers.map((marker) => {
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
