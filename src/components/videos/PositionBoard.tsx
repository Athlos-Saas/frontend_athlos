import { useMemo, useState } from 'react';
import { ArrowLeftRight, UserCheck, X } from 'lucide-react';

import { PitchMarkings, type TrajectoryPoint } from '@/components/charts/SoccerPitchMap';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import type { VideoPlayerTrack } from '@/types/domain';

const FIELD_LENGTH_M = 105;
const FIELD_WIDTH_M = 68;

/** Zonas por franja horizontal de la cancha (fracción 0..1 del eje X del video). */
const ZONES = [
  { key: 'portero', label: 'Portero', from: 0, to: 0.14 },
  { key: 'defensa', label: 'Defensa', from: 0.14, to: 0.38 },
  { key: 'medio', label: 'Mediocampo', from: 0.38, to: 0.62 },
  { key: 'delantero', label: 'Delantero', from: 0.62, to: 1.0 },
] as const;

type ZoneKey = (typeof ZONES)[number]['key'];

export interface RosterOption {
  id: string;
  full_name: string;
  position: string | null;
}

interface TrackMarker {
  trackId: string;
  x: number; // fracción 0..1 (ya con inversión aplicada si corresponde)
  y: number;
  matchedPlayerId: string | null;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/**
 * Tablero de asignación: promedia la posición real de cada track detectado
 * por el computer vision y lo pinta sobre la cancha. El usuario elige un
 * jugador del roster y (a) toca marcadores individuales, o (b) asigna una
 * zona completa (portero/defensa/medio/delantero) — así los track IDs
 * fragmentados del mismo jugador quedan unificados en `matched_player_id`.
 * Nada se calcula "mágicamente": la asignación siempre la decide el usuario.
 */
export function PositionBoard({
  trajectories,
  tracks,
  players,
  isSaving,
  onAssign,
}: {
  trajectories: Record<string, TrajectoryPoint[]>;
  tracks: VideoPlayerTrack[];
  players: RosterOption[];
  isSaving: boolean;
  onAssign: (trackIds: number[], playerId: string | null) => Promise<void>;
}) {
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [activeZone, setActiveZone] = useState<ZoneKey | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);

  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const assignmentByTrack = useMemo(
    () => new Map(tracks.map((track) => [String(track.track_id), track.matched_player_id ?? null])),
    [tracks],
  );

  const markers = useMemo<TrackMarker[]>(() => {
    return Object.entries(trajectories)
      .map(([trackId, points]) => {
        if (points.length === 0) return null;
        const avgX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const avgY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
        return {
          trackId,
          x: isFlipped ? 1 - avgX : avgX,
          y: avgY,
          matchedPlayerId: assignmentByTrack.get(trackId) ?? null,
        };
      })
      .filter((marker): marker is TrackMarker => marker !== null);
  }, [trajectories, assignmentByTrack, isFlipped]);

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

  const handleMarkerClick = (marker: TrackMarker) => {
    if (isSaving) return;
    const trackId = Number(marker.trackId);
    if (marker.matchedPlayerId && marker.matchedPlayerId === selectedPlayerId) {
      onAssign([trackId], null); // segundo click con el mismo jugador = quitar
      return;
    }
    if (!selectedPlayerId) return;
    onAssign([trackId], selectedPlayerId);
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
          <SelectTrigger className="h-9 w-60">
            <SelectValue placeholder="1. Elige un jugador del roster…" />
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

        <div className="flex items-center gap-1">
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
        </div>

        <Button size="sm" variant="ghost" onClick={() => setIsFlipped((v) => !v)}>
          <ArrowLeftRight className="size-4" aria-hidden="true" /> Invertir lados
        </Button>

        {activeZone && selectedPlayerId && zoneTrackIds.length > 0 && (
          <Button size="sm" isLoading={isSaving} onClick={() => onAssign(zoneTrackIds, selectedPlayerId)}>
            <UserCheck className="size-4" aria-hidden="true" />
            Asignar {zoneTrackIds.length} lecturas de {ZONES.find((z) => z.key === activeZone)?.label.toLowerCase()}
          </Button>
        )}
      </div>

      <p className="mb-2 text-xs text-muted-foreground">
        2. Toca una lectura en la cancha para asignarla al jugador elegido (tócala de nuevo para quitarla), o usa una zona para
        asignar todas sus lecturas de una vez. Verde = ya asignada.
      </p>

      <svg
        viewBox={`-2 -2 ${FIELD_LENGTH_M + 4} ${FIELD_WIDTH_M + 4}`}
        className="w-full rounded-lg border border-border"
        style={{ background: 'linear-gradient(180deg, #14532d, #0f3d24)' }}
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

        {markers.map((marker) => {
          const cx = marker.x * FIELD_LENGTH_M;
          const cy = marker.y * FIELD_WIDTH_M;
          const assignedPlayer = marker.matchedPlayerId ? playerById.get(marker.matchedPlayerId) : null;
          return (
            <g
              key={marker.trackId}
              onClick={() => handleMarkerClick(marker)}
              className="cursor-pointer"
              role="button"
              aria-label={`Track ${marker.trackId}${assignedPlayer ? ` asignado a ${assignedPlayer.full_name}` : ''}`}
            >
              <circle
                cx={cx}
                cy={cy}
                r={2.6}
                fill={assignedPlayer ? '#22c55e' : '#3b82f6'}
                stroke="#ffffff"
                strokeWidth={0.35}
                opacity={0.92}
              />
              <text x={cx} y={cy + 0.9} textAnchor="middle" fontSize={2.2} fontWeight={700} fill="#ffffff">
                {assignedPlayer ? initials(assignedPlayer.full_name) : marker.trackId}
              </text>
            </g>
          );
        })}
      </svg>

      {assignedGroups.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {assignedGroups.map(([playerId, trackIds]) => {
            const player = playerById.get(playerId);
            return (
              <div key={playerId} className="flex flex-wrap items-center gap-2 rounded-md bg-panel px-3 py-2 text-sm">
                <Badge variant="success">{player?.full_name ?? 'Jugador'}</Badge>
                <span className="text-xs text-muted-foreground">
                  {trackIds.length} lecturas: {trackIds.map((id) => `J${id}`).join(', ')}
                </span>
                <button
                  type="button"
                  className="focus-ring ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:text-danger"
                  onClick={() => onAssign(trackIds.map(Number), null)}
                >
                  <X className="size-3" aria-hidden="true" /> Quitar todas
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
