/**
 * Panel de red de pases del análisis de video: filtro por equipo, estado vacío
 * honesto y exportación (PNG con firma + CSV de aristas).
 *
 * Los eventos NO se vuelven a pedir acá: Videos.tsx ya los lee de
 * `video_events` con el cliente ANON (RLS hereda el permiso del video padre) y
 * los pasa a MatchInsights. Una segunda consulta sería el mismo dato dos veces
 * y dos estados de carga que pueden contradecirse.
 */
import { useMemo, useState } from 'react';
import { Network } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  buildPassNetwork,
  PASS_NETWORK_MIN_PASSES,
  PassNetworkChart,
  type PassNetworkEdge,
  type PassNetworkTeamFilter,
} from '@/components/charts/PassNetworkChart';
import { Button } from '@/components/ui/Button';
import { ChartCard } from '@/components/ui/ChartCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { resolveSport } from '@/constants/sports';
import type { VideoEvent, VideoEventStats } from '@/types/domain';

const TEAM_LABELS: Record<number, string> = { 0: 'A', 1: 'B' };

export interface PassNetworkPanelProps {
  events: VideoEvent[];
  eventStats: VideoEventStats | null;
  /** Color real de camiseta por equipo (0/1), si se conoce. */
  teamColors: Map<number, string>;
  playerNameByTrack: Map<number, string>;
  /** true si las coordenadas salen de la escala de respaldo (sin homografía). */
  approximate: boolean;
  /** Título del video, para el nombre del archivo exportado. */
  videoTitle?: string;
}

export function PassNetworkPanel({
  events,
  eventStats,
  teamColors,
  playerNameByTrack,
  approximate,
  videoTitle,
}: PassNetworkPanelProps) {
  const { t } = useTranslation();
  // El pipeline guarda en event_stats el deporte con que proyectó a metros;
  // los videos anteriores no lo traen y son todos de fútbol (default).
  const sport = resolveSport(eventStats?.sport);

  const passesByTeam = useMemo(() => {
    const counts: Record<0 | 1, number> = { 0: 0, 1: 0 };
    for (const event of events) {
      if (event.event_type === 'pass' && (event.team_cluster === 0 || event.team_cluster === 1)) {
        counts[event.team_cluster] += 1;
      }
    }
    return counts;
  }, [events]);

  // Por defecto el equipo con más pases: una red de pases se lee por equipo
  // (mezclar los dos superpone dos estructuras distintas en la misma cancha).
  const [team, setTeam] = useState<PassNetworkTeamFilter>(() => (passesByTeam[1] > passesByTeam[0] ? 1 : 0));

  const network = useMemo(() => buildPassNetwork(events, team, sport), [events, team, sport]);
  const hasEnough = network.passCount > PASS_NETWORK_MIN_PASSES && network.edges.length > 0;

  const label = (trackId: number) => playerNameByTrack.get(trackId) ?? `#${trackId}`;

  const csvRows = useMemo(
    () =>
      network.edges
        .slice()
        .sort((x, y) => y.count - x.count)
        .map((edge) => ({
          track_a: edge.a,
          player_a: label(edge.a),
          track_b: edge.b,
          player_b: label(edge.b),
          passes_a_to_b: edge.aToB,
          passes_b_to_a: edge.bToA,
          passes_total: edge.count,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [network.edges, playerNameByTrack],
  );

  const teamName = (value: PassNetworkTeamFilter) =>
    value === 'all'
      ? t('dataviz.passNetwork.bothTeams', 'Ambos')
      : `${t('dataviz.passNetwork.team', 'Equipo')} ${TEAM_LABELS[value]}`;

  const filterButtons = (
    <div className="flex items-center gap-1" role="group" aria-label={t('dataviz.passNetwork.filterLabel', 'Filtrar por equipo')}>
      {([0, 1, 'all'] as PassNetworkTeamFilter[]).map((value) => (
        <Button
          key={String(value)}
          size="sm"
          variant={team === value ? 'secondary' : 'ghost'}
          aria-pressed={team === value}
          onClick={() => setTeam(value)}
        >
          {value === 'all' ? teamName(value) : TEAM_LABELS[value]}
          {value !== 'all' && <span className="tabular-nums text-muted-foreground">({passesByTeam[value]})</span>}
        </Button>
      ))}
    </div>
  );

  const description = [
    t(
      'dataviz.passNetwork.description',
      'Cada nodo es un jugador en la posición media donde inició sus pases; el grosor de la línea es la cantidad de pases entre el par.',
    ),
    hasEnough ? t('dataviz.passNetwork.passCount', '{{count}} pases · {{team}}', { count: network.passCount, team: teamName(team) }) : '',
    approximate ? t('dataviz.passNetwork.approximate', 'Posiciones aproximadas (cancha sin calibrar).') : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <ChartCard
      title={t('dataviz.passNetwork.title', 'Red de pases')}
      description={description}
      height={hasEnough ? 440 : 260}
      actions={filterButtons}
      exportable={hasEnough}
      exportData={hasEnough ? csvRows : undefined}
      exportFileName={`${t('dataviz.passNetwork.fileName', 'red-de-pases')}${videoTitle ? `-${videoTitle}` : ''}`}
    >
      {hasEnough ? (
        <PassNetworkChart
          network={network}
          sport={sport}
          teamColors={teamColors}
          labelForTrack={label}
          ariaLabel={t('dataviz.passNetwork.aria', 'Red de pases: {{nodes}} jugadores, {{edges}} conexiones', {
            nodes: network.nodes.length,
            edges: network.edges.length,
          })}
          edgeTitle={(edge: PassNetworkEdge) =>
            t('dataviz.passNetwork.edgeTitle', '{{a}} → {{b}}: {{ab}} · {{b}} → {{a}}: {{ba}}', {
              a: label(edge.a),
              b: label(edge.b),
              ab: edge.aToB,
              ba: edge.bToA,
            })
          }
          nodeTitle={(node) =>
            node.positionSource === 'reception'
              ? t('dataviz.passNetwork.nodeTitleReception', '{{name}}: {{received}} recibidos, sin pases dados (ubicado donde recibió)', {
                  name: label(node.trackId),
                  received: node.passesReceived,
                })
              : t('dataviz.passNetwork.nodeTitle', '{{name}}: {{made}} pases dados, {{received}} recibidos', {
                  name: label(node.trackId),
                  made: node.passesMade,
                  received: node.passesReceived,
                })
          }
        />
      ) : (
        <EmptyState
          icon={Network}
          className="h-full py-6"
          title={t('dataviz.passNetwork.emptyTitle', 'No hay pases suficientes para una red')}
          description={t(
            'dataviz.passNetwork.emptyDescription',
            'Se detectaron {{count}} pases con emisor, receptor y posición para este filtro. Hacen falta más de {{min}} para que la red diga algo; con menos, revisa los pases uno por uno en la tabla de eventos.',
            { count: network.passCount, min: PASS_NETWORK_MIN_PASSES },
          )}
        />
      )}
    </ChartCard>
  );
}
