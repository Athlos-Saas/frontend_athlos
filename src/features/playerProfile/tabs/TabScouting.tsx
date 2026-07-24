import { useMemo } from 'react';
import { Target } from 'lucide-react';

import { BenchmarkBarChart } from '@/components/charts/BenchmarkBarChart';
import { Badge } from '@/components/ui/Badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ChartCard } from '@/components/ui/ChartCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePlayerLeagueStats, useTeamBenchmarks } from '../queries';

export default function TabScouting({ orgId, playerId }: { orgId: string; playerId: string }) {
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
  const hasScoutingSignals = Boolean(roleLabel) || attackerRow?.proba_top_scorer !== undefined;

  if (!hasScoutingSignals && !positionGroup) {
    return (
      <EmptyState
        icon={Target}
        title="Sin señales de scouting"
        description="Este jugador no está reconciliado con estadísticas de liga, así que no hay rol ni probabilidades de modelo que mostrar."
      />
    );
  }

  return (
    <div className="space-y-5">
      {hasScoutingSignals && (
        <Card>
          <CardHeader>
            <CardTitle>Perfil de scouting</CardTitle>
          </CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            {roleLabel && <Badge variant="purple">Rol: {roleLabel}</Badge>}
            {attackerRow?.proba_top_scorer !== undefined && attackerRow?.proba_top_scorer !== null && (
              <Badge variant={attackerRow.proba_top_scorer >= 0.7 ? 'success' : 'neutral'}>
                Prob. goleador élite: {(attackerRow.proba_top_scorer * 100).toFixed(0)}%
              </Badge>
            )}
          </div>
        </Card>
      )}

      {benchmarks.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : benchmarkData.length > 0 ? (
        <ChartCard
          title="Rendimiento del equipo vs. conferencia"
          description={teamName ? `${teamName} vs. media de la conferencia — dato de equipo, no individual del jugador` : 'Dato de equipo, no individual del jugador'}
        >
          <BenchmarkBarChart data={benchmarkData} teamLabel={teamName ?? 'Equipo'} />
        </ChartCard>
      ) : (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Rendimiento vs. conferencia</CardTitle>
              <CardDescription className="mt-1">Sin benchmarks de conferencia para la temporada/posición de este equipo.</CardDescription>
            </div>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
