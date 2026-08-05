/**
 * Capas analíticas del análisis de video (backend: tracking_store /
 * event_detection / match_metrics).
 *
 * Muestra tres cosas que antes no existían: eventos derivados de la
 * trayectoria (pases, pérdidas, conducciones), métricas por jugador con su
 * mapa de calor de ocupación real, y la forma del bloque por equipo.
 *
 * Principio de diseño, heredado del backend: **un cero se explica, no se
 * muestra pelado**. El backend guarda en `event_stats` / `metrics_stats` el
 * motivo por el que algo salió vacío (sin pelota detectada, sin homografía,
 * kits que no separan), y este componente lo sube a la superficie en vez de
 * dibujar paneles en cero que parecen un bug. Lo mismo con la fiabilidad
 * geométrica: si el pipeline avisa que las coordenadas salen de la escala
 * lineal de respaldo, las métricas en metros se muestran marcadas como
 * aproximadas, nunca como si fueran medidas.
 */

import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, Flame, Info, Share2, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type {
  VideoEvent,
  VideoEventStats,
  VideoEventType,
  VideoHeatmap,
  VideoMetricsStats,
  VideoPlayerMetrics,
  VideoPlayerTrack,
  VideoTeamMetrics,
} from '@/types/domain';

const TEAM_LABELS: Record<number, string> = { 0: 'A', 1: 'B' };

/** Rampa del mapa de calor: transparente -> ámbar -> rojo. Se usa color y
 * opacidad a la vez para que se lea también en tema claro. */
function heatColor(intensity: number): string {
  if (intensity <= 0) return 'transparent';
  const hue = 45 - 45 * Math.min(1, intensity); // 45 (ámbar) -> 0 (rojo)
  return `hsl(${hue} 90% 55% / ${0.12 + 0.78 * Math.min(1, intensity)})`;
}

function isHeatmap(value: unknown): value is VideoHeatmap {
  return (
    !!value &&
    typeof value === 'object' &&
    Array.isArray((value as VideoHeatmap).grid) &&
    (value as VideoHeatmap).grid.length > 0
  );
}

function formatSeconds(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function Panel({
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
    <div className="rounded-lg border border-border bg-card p-4 shadow-subtle">
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

/** Mapa de calor dibujado desde la grilla que ya calculó el backend — acá no
 * se recalcula nada, solo se pinta. La cancha se ve de lado: el eje X (largo,
 * de arco a arco) es horizontal.
 *
 * Las filas se dibujan EN ORDEN (0 arriba), no invertidas. El eje Y del
 * pipeline nace en el borde superior de la imagen (`pitch_calibration` proyecta
 * desde píxeles, donde y crece hacia abajo), y el `SoccerPitchMap` que ya usa
 * el tablero táctico dibuja con esa misma convención (SVG sin transform, cy
 * crece hacia abajo). Invertir acá dejaba este mapa en espejo vertical
 * respecto del video y del tablero. */
function HeatmapGrid({ heatmap, label }: { heatmap: VideoHeatmap; label: string }) {
  const peak = useMemo(() => Math.max(...heatmap.grid) || 1, [heatmap.grid]);
  const rows = useMemo(() => {
    const out: number[][] = [];
    for (let row = 0; row < heatmap.rows; row += 1) {
      out.push(heatmap.grid.slice(row * heatmap.cols, (row + 1) * heatmap.cols));
    }
    return out;
  }, [heatmap]);

  return (
    <div>
      <div
        className="overflow-hidden rounded-md border border-border"
        style={{ background: 'linear-gradient(180deg, #14532d, #0f3d24)' }}
        role="img"
        aria-label={label}
      >
        {rows.map((cells, rowIndex) => (
          <div key={rowIndex} className="flex">
            {cells.map((value, colIndex) => (
              <div
                key={colIndex}
                className="aspect-square flex-1 border-[0.5px] border-white/5"
                style={{ backgroundColor: heatColor(value / peak) }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const EVENT_STYLE: Record<VideoEventType, { label: string; variant: 'ai' | 'danger' | 'purple' | 'neutral' }> = {
  pass: { label: 'Pase', variant: 'ai' },
  turnover: { label: 'Pérdida', variant: 'danger' },
  carry: { label: 'Conducción', variant: 'purple' },
  possession_change: { label: 'Cambio de posesión', variant: 'neutral' },
};

export function MatchInsights({
  events,
  playerMetrics,
  teamMetrics,
  tracks,
  eventStats,
  metricsStats,
  trackingPoints,
  playerNameByTrack,
}: {
  events: VideoEvent[];
  playerMetrics: VideoPlayerMetrics[];
  teamMetrics: VideoTeamMetrics[];
  tracks: VideoPlayerTrack[];
  eventStats: VideoEventStats | null;
  metricsStats: VideoMetricsStats | null;
  trackingPoints: number | null;
  /** Nombre del jugador del roster asignado a cada track, si lo hay. */
  playerNameByTrack: Map<number, string>;
}) {
  const { t } = useTranslation();
  const [showAllPlayers, setShowAllPlayers] = useState(false);

  const colorByTeam = useMemo(() => {
    const map = new Map<number, string>();
    for (const track of tracks) {
      const team = track.team_cluster;
      if (team === null || team === undefined || map.has(team) || !track.shirt_color) continue;
      map.set(team, track.shirt_color);
    }
    return map;
  }, [tracks]);

  const warnings = useMemo(() => {
    const all = [...(eventStats?.warnings ?? []), ...(metricsStats?.warnings ?? [])];
    return Array.from(new Set(all));
  }, [eventStats, metricsStats]);

  const geometryReliable = metricsStats?.geometry_reliable ?? eventStats?.pitch_calibrated ?? null;
  const hasEvents = events.length > 0;

  const trackLabel = (trackId: number | null | undefined): string => {
    if (trackId === null || trackId === undefined) return '—';
    return playerNameByTrack.get(trackId) ?? `#${trackId}`;
  };

  // El video se procesó antes de que existieran estas capas: no hay nada que
  // mostrar, pero tampoco es un error — hay que decir cómo obtenerlo.
  if (!trackingPoints) {
    return (
      <EmptyState
        icon={Info}
        title={t('videos.insights.legacyTitle', 'Este video no tiene las capas de análisis')}
        description={t(
          'videos.insights.legacyDescription',
          'Se procesó antes de que existieran los eventos y las métricas. Volvé a analizarlo (preferentemente con el modelo Small) para generarlas.',
        )}
      />
    );
  }

  // Con eventos, lo más relevante es quién tuvo más la pelota. Sin eventos ese
  // criterio es un empate en cero y el orden quedaría arbitrario, así que se
  // ordena por cuántas posiciones se le registraron: los jugadores mejor
  // seguidos primero, que es la información que sí hay.
  const sortedPlayers = [...playerMetrics].sort((a, b) => {
    if (hasEvents) return b.possession_time_s - a.possession_time_s || a.track_id - b.track_id;
    const pointsOf = (metrics: VideoPlayerMetrics) =>
      isHeatmap(metrics.heatmap) ? metrics.heatmap.points : 0;
    return pointsOf(b) - pointsOf(a) || a.track_id - b.track_id;
  });
  const visiblePlayers = showAllPlayers ? sortedPlayers : sortedPlayers.slice(0, 6);

  return (
    <div className="space-y-4">
      {geometryReliable === false && (
        <div className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 p-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <div className="text-xs leading-relaxed text-foreground">
            <p className="font-semibold">
              {t('videos.insights.geometryTitle', 'Distancias aproximadas')}
            </p>
            <p className="text-muted-foreground">
              {t(
                'videos.insights.geometryDescription',
                'No se pudo calibrar la cancha en este video, así que todo lo expresado en metros (ancho, profundidad, área, avance) sale de una escala de respaldo. Los mapas de calor, al ser posiciones relativas, se ven menos afectados.',
              )}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ---------------------------------------------------- Eventos */}
        <Panel
          icon={Share2}
          title={t('videos.insights.eventsTitle', 'Eventos detectados')}
          subtitle={t('videos.insights.eventsSubtitle', 'Derivados de la trayectoria y la pelota')}
          accent="bg-ai/15 text-ai"
        >
          {events.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-3">
              <p className="text-xs font-medium text-foreground">
                {t('videos.insights.noEvents', 'Sin eventos en este video')}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {eventStats?.skipped_reason ??
                  t(
                    'videos.insights.noEventsFallback',
                    'No hubo material suficiente para derivar eventos.',
                  )}
              </p>
              {eventStats?.ball_coverage !== undefined && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {t('videos.insights.ballCoverage', 'Pelota detectada en')}{' '}
                  <span className="font-semibold text-foreground">
                    {eventStats.ball_frames ?? 0} {t('videos.insights.frames', 'frames')}
                  </span>{' '}
                  ({(eventStats.ball_coverage * 100).toFixed(1)}%)
                  {eventStats.yolo_model ? ` · ${t('videos.insights.model', 'modelo')} ${eventStats.yolo_model}` : ''}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {Object.entries(eventStats?.events_by_type ?? {}).map(([type, count]) => (
                  <Badge key={type} variant={EVENT_STYLE[type as VideoEventType]?.variant ?? 'neutral'}>
                    {EVENT_STYLE[type as VideoEventType]?.label ?? type}: {count}
                  </Badge>
                ))}
              </div>
              <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-panel text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">{t('videos.insights.time', 'Min')}</th>
                      <th className="px-2 py-1.5 text-left font-medium">{t('videos.insights.type', 'Tipo')}</th>
                      <th className="px-2 py-1.5 text-left font-medium">{t('videos.insights.who', 'Quién')}</th>
                      <th className="px-2 py-1.5 text-right font-medium">{t('videos.insights.length', 'Largo')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event) => (
                      <tr key={event.id} className="border-t border-border/60">
                        <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{formatSeconds(event.t_s)}</td>
                        <td className="px-2 py-1.5">
                          <Badge variant={EVENT_STYLE[event.event_type]?.variant ?? 'neutral'}>
                            {EVENT_STYLE[event.event_type]?.label ?? event.event_type}
                          </Badge>
                        </td>
                        <td className="px-2 py-1.5 text-foreground">
                          {trackLabel(event.track_id)}
                          {event.end_track_id !== null && event.end_track_id !== undefined
                            ? ` → ${trackLabel(event.end_track_id)}`
                            : ''}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                          {event.length_m !== null && event.length_m !== undefined
                            ? `${event.length_m.toFixed(1)} m`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>

        {/* ------------------------------------------- Forma del bloque */}
        <Panel
          icon={Users}
          title={t('videos.insights.shapeTitle', 'Forma del bloque')}
          subtitle={t('videos.insights.shapeSubtitle', 'Promedio sobre los frames con equipo visible')}
          accent="bg-purple/15 text-purple"
        >
          {teamMetrics.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-3">
              <p className="text-xs font-medium text-foreground">
                {t('videos.insights.noShape', 'Sin forma de bloque')}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {metricsStats?.shape_skipped_reason ??
                  t(
                    'videos.insights.noShapeFallback',
                    'No se pudo agrupar a los jugadores en dos equipos por color de camiseta.',
                  )}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {teamMetrics.map((team) => (
                <div key={team.team_cluster} className="rounded-md border border-border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="size-3 rounded-full border border-border"
                      style={{ backgroundColor: colorByTeam.get(team.team_cluster) ?? '#64748b' }}
                      aria-hidden="true"
                    />
                    <span className="text-xs font-semibold text-foreground">
                      {t('videos.insights.team', 'Equipo')} {TEAM_LABELS[team.team_cluster] ?? team.team_cluster}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {team.frames_sampled} {t('videos.insights.framesSampled', 'frames')} ·{' '}
                      {team.mean_players_visible?.toFixed(1) ?? '—'}{' '}
                      {t('videos.insights.playersVisible', 'jug. visibles')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] sm:grid-cols-3">
                    <Stat label={t('videos.insights.width', 'Ancho')} value={team.mean_width_m} unit="m" />
                    <Stat label={t('videos.insights.depth', 'Profundidad')} value={team.mean_depth_m} unit="m" />
                    <Stat label={t('videos.insights.area', 'Área')} value={team.mean_area_m2} unit="m²" />
                    <Stat
                      label={t('videos.insights.compactness', 'Compacidad')}
                      value={team.mean_compactness_m}
                      unit="m"
                    />
                    <Stat
                      label={t('videos.insights.defensiveLine', 'Línea def.')}
                      value={team.defensive_line_m}
                      unit="m"
                    />
                    <Stat
                      label={t('videos.insights.possession', 'Posesión')}
                      value={team.possession_share !== null && team.possession_share !== undefined
                        ? team.possession_share * 100
                        : null}
                      unit="%"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* ------------------------------------------------ Por jugador */}
      <Panel
        icon={Flame}
        title={
          hasEvents
            ? t('videos.insights.playersTitle', 'Ocupación y eventos por jugador')
            : t('videos.insights.playersTitleNoEvents', 'Ocupación por jugador')
        }
        subtitle={t('videos.insights.playersSubtitle', 'Mapa de calor sobre la cancha real')}
        accent="bg-warning/15 text-warning"
      >
        {visiblePlayers.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t('videos.insights.noPlayerMetrics', 'Todavía no hay métricas por jugador para este video.')}
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visiblePlayers.map((player) => {
                const heatmap = player.heatmap;
                const name = playerNameByTrack.get(player.track_id) ?? `Track #${player.track_id}`;
                return (
                  <div key={player.track_id} className="rounded-md border border-border p-2.5">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="truncate text-[11px] font-semibold text-foreground">{name}</span>
                      {player.team_cluster !== null && player.team_cluster !== undefined && (
                        <Badge variant="neutral">{TEAM_LABELS[player.team_cluster] ?? player.team_cluster}</Badge>
                      )}
                    </div>
                    {isHeatmap(heatmap) ? (
                      <HeatmapGrid
                        heatmap={heatmap}
                        label={t('videos.insights.heatmapAlt', 'Mapa de calor de {{name}}', { name })}
                      />
                    ) : (
                      <div className="rounded-md border border-dashed border-border py-6 text-center text-[10px] text-muted-foreground">
                        {t('videos.insights.noHeatmap', 'Sin posiciones suficientes')}
                      </div>
                    )}
                    {/* Los contadores solo se muestran si el video tiene
                     * eventos. Sin pelota detectada TODOS valen cero por
                     * construcción, y repetir cuatro ceros por jugador es
                     * ruido que además se lee como si el jugador no hubiera
                     * hecho nada — cuando lo que pasó es que no se pudo
                     * medir. El panel de eventos ya explica el motivo una
                     * sola vez. */}
                    {hasEvents ? (
                      <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                        <span>
                          {t('videos.insights.withBall', 'Con pelota')}:{' '}
                          <span className="font-semibold text-foreground">
                            {formatSeconds(player.possession_time_s)}
                          </span>
                        </span>
                        <span>
                          {t('videos.insights.passesShort', 'Pases')}:{' '}
                          <span className="font-semibold text-foreground">{player.passes_made}</span>
                        </span>
                        <span>
                          {t('videos.insights.carriesShort', 'Conducciones')}:{' '}
                          <span className="font-semibold text-foreground">{player.carries}</span>
                        </span>
                        <span>
                          {t('videos.insights.lossesShort', 'Pérdidas')}:{' '}
                          <span className="font-semibold text-foreground">{player.turnovers_lost}</span>
                        </span>
                      </div>
                    ) : (
                      isHeatmap(heatmap) && (
                        <p className="mt-2 text-[10px] text-muted-foreground">
                          {t('videos.insights.positionsCount', '{{count}} posiciones registradas', {
                            count: heatmap.points,
                          })}
                        </p>
                      )
                    )}
                  </div>
                );
              })}
            </div>
            {sortedPlayers.length > 6 && (
              <div className="mt-3 text-center">
                <Button variant="secondary" onClick={() => setShowAllPlayers((current) => !current)}>
                  {showAllPlayers
                    ? t('videos.insights.showLess', 'Ver menos')
                    : t('videos.insights.showAll', 'Ver los {{count}}', { count: sortedPlayers.length })}
                </Button>
              </div>
            )}
          </>
        )}
      </Panel>

      {/* --------------------------------------------- Transparencia */}
      {warnings.length > 0 && (
        <Panel
          icon={Activity}
          title={t('videos.insights.limitsTitle', 'Qué tan confiable es esto')}
          subtitle={t('videos.insights.limitsSubtitle', 'Límites que reportó el propio análisis')}
          accent="bg-border/60 text-muted-foreground"
        >
          <ul className="space-y-1.5">
            {warnings.map((warning) => (
              <li key={warning} className="flex gap-2 text-[11px] leading-relaxed text-muted-foreground">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden="true" />
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: number | null | undefined; unit: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="tabular-nums font-semibold text-foreground">
        {value === null || value === undefined ? '—' : `${value.toFixed(1)} ${unit}`}
      </p>
    </div>
  );
}
