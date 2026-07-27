import { useMemo } from 'react';
import { Target } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { BenchmarkBarChart } from '@/components/charts/BenchmarkBarChart';
import { Badge } from '@/components/ui/Badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ChartCard } from '@/components/ui/ChartCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePlayerLeagueStats, useTeamBenchmarks } from '../queries';

export default function TabScouting({ orgId, playerId }: { orgId: string; playerId: string }) {
  const { t } = useTranslation();
  const leagueStats = usePlayerLeagueStats(orgId, playerId);

  const attackerRow = leagueStats.data?.attacker[0];
  const goalkeeperRow = leagueStats.data?.goalkeeper[0];
  const positionGroup: 'attacker' | 'goalkeeper' | null = attackerRow ? 'attacker' : goalkeeperRow ? 'goalkeeper' : null;
  const season = attackerRow?.season ?? goalkeeperRow?.season ?? null;
  const teamName = attackerRow?.team_name ?? goalkeeperRow?.team_name ?? null;

  const benchmarks = useTeamBenchmarks(orgId, season, positionGroup);

  const benchmarkData = useMemo(
    () => (benchmarks.data ?? []).map((row) => ({ metric: row.metric, team_value: row.team_value, conference_value: row.conference_value })),
    [benchmarks.data],
  );

  if (leagueStats.isLoading) return <Skeleton className="h-72 w-full" />;

  const roleLabel = attackerRow?.role_name ?? goalkeeperRow?.gk_role ?? null;
  const similarPlayers = attackerRow?.similar_players ?? goalkeeperRow?.similar_players ?? [];
  const hasScoutingSignals = Boolean(roleLabel) || attackerRow?.proba_top_scorer !== undefined;

  if (!hasScoutingSignals && !positionGroup) {
    return (
      <EmptyState
        icon={Target}
        title={t('tabScouting.emptyTitle', 'Sin señales de scouting')}
        description={t(
          'tabScouting.emptyDescription',
          'Este jugador no está reconciliado con estadísticas de liga, así que no hay rol ni probabilidades de modelo que mostrar.',
        )}
      />
    );
  }

  return (
    <div className="space-y-5">
      {hasScoutingSignals && (
        <Card>
          <CardHeader>
            <CardTitle>{t('tabScouting.profileTitle', 'Perfil de scouting')}</CardTitle>
          </CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            {roleLabel && <Badge variant="purple">{t('tabScouting.roleLabel', 'Rol: {{role}}', { role: roleLabel })}</Badge>}
            {attackerRow?.proba_top_scorer !== undefined && attackerRow?.proba_top_scorer !== null && (
              <Badge variant={attackerRow.proba_top_scorer >= 0.7 ? 'success' : 'neutral'}>
                {t('tabScouting.topScorerProb', 'Prob. goleador élite: {{value}}%', {
                  value: (attackerRow.proba_top_scorer * 100).toFixed(0),
                })}
              </Badge>
            )}
          </div>
        </Card>
      )}

      {similarPlayers.length > 0 && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t('tabScouting.similarPlayersTitle', 'Jugadores similares')}</CardTitle>
              <CardDescription className="mt-1">
                {t(
                  'tabScouting.similarPlayersDescription',
                  'Por distancia estadística en la misma temporada/competición — no es un match de posición, es similitud de perfil (goles, asistencias, tiros por partido).',
                )}
              </CardDescription>
            </div>
          </CardHeader>
          <div className="flex flex-wrap gap-2">
            {similarPlayers.map((similar) => (
              <Badge key={`${similar.player_name}-${similar.team_name}`} variant="neutral">
                {similar.player_name} · {similar.team_name}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {benchmarks.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : benchmarkData.length > 0 ? (
        <ChartCard
          title={t('tabScouting.benchmarkTitle', 'Rendimiento del equipo vs. conferencia')}
          description={
            teamName
              ? t('tabScouting.benchmarkDescriptionWithTeam', '{{team}} vs. media de la conferencia — dato de equipo, no individual del jugador', {
                  team: teamName,
                })
              : t('tabScouting.teamDataOnly', 'Dato de equipo, no individual del jugador')
          }
        >
          <BenchmarkBarChart data={benchmarkData} teamLabel={teamName ?? t('tabScouting.teamFallback', 'Equipo')} />
        </ChartCard>
      ) : (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t('tabScouting.benchmarkEmptyTitle', 'Rendimiento vs. conferencia')}</CardTitle>
              <CardDescription className="mt-1">
                {t('tabScouting.benchmarkEmptyDescription', 'Sin benchmarks de conferencia para la temporada/posición de este equipo.')}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
