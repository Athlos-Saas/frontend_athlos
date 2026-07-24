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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
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
              <g>
                <path d={trackPath.pathD} stroke="#3b82f6" strokeWidth={0.5} fill="none" opacity={0.45} strokeLinecap="round" />
                <circle r={1.7} fill="#7c3aed" style={{ filter: 'drop-shadow(0 0 3px #7c3aed)' }}>
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

            {markers.map((marker) => {
              const cx = marker.x * FIELD_LENGTH_M;
              const cy = marker.y * FIELD_WIDTH_M;
              const assigned = marker.matchedPlayerId ? playerById.get(marker.matchedPlayerId) : null;
              const isSelected = marker.trackId === selectedTrackId;
              return (
                <g
                  key={marker.trackId}
                  onClick={() => setSelectedTrackId((current) => (current === marker.trackId ? null : marker.trackId))}
                  className="cursor-pointer"
                  role="button"
                  aria-label={`Identidad J${marker.trackId}${assigned ? ` asignada a ${assigned.full_name}` : ''}`}
                >
                  {isSelected && (
                    <circle cx={cx} cy={cy} r={3.6} fill="none" stroke="#ffffff" strokeWidth={0.4} className="animate-pulse" />
                  )}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={2.4}
                    fill={assigned ? '#22c55e' : '#3b82f6'}
                    stroke="#ffffff"
                    strokeWidth={0.3}
                    opacity={isSelected ? 1 : 0.85}
                  />
                  <text x={cx} y={cy + 0.85} textAnchor="middle" fontSize={2} fontWeight={700} fill="#ffffff">
                    {assigned ? initials(assigned.full_name) : marker.trackId}
                  </text>
                </g>
              );
            })}
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
