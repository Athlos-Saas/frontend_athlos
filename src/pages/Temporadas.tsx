import { useEffect, useState } from 'react';
import { CalendarRange, Shield, Trophy, Users } from 'lucide-react';

import { TrendAreaChart } from '@/components/charts/TrendAreaChart';
import { Badge } from '@/components/ui/Badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ChartCard } from '@/components/ui/ChartCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { colors } from '@/constants/tokens';
import { supabase } from '@/lib/supabase';
import { toast } from '@/store/toastStore';
import type { Team } from '@/types/domain';

interface SeasonSummary {
  season: string;
  teams: Team[];
  playerCount: number;
  leagueAttackerRows: number;
  leagueGoalkeeperRows: number;
}

/**
 * Vista por temporada construida SOLO con lo que existe: `teams.season`,
 * conteo de jugadores por equipo y filas de liga por `season`. Las sesiones
 * GPS no tienen columna de temporada — se muestran aparte como actividad
 * mensual real (por fecha), sin asociarlas artificialmente a una temporada.
 */
export default function Temporadas({ orgId }: { orgId: string }) {
  const [summaries, setSummaries] = useState<SeasonSummary[] | null>(null);
  const [monthlySessions, setMonthlySessions] = useState<{ mes: string; sesiones: number }[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from('teams').select('id, name, sport, season').eq('org_id', orgId),
      supabase.from('players').select('id, team_id').eq('org_id', orgId).eq('is_active', true),
      supabase.from('league_attacker_stats').select('season').eq('org_id', orgId),
      supabase.from('league_goalkeeper_stats').select('season').eq('org_id', orgId),
      supabase.from('gps_sessions').select('session_date').eq('org_id', orgId).order('session_date'),
    ]).then(([teamsRes, playersRes, attackerRes, gkRes, gpsRes]) => {
      if (teamsRes.error) {
        toast({ title: 'No se pudieron cargar las temporadas', description: teamsRes.error.message, variant: 'danger' });
        setSummaries([]);
        return;
      }
      const teams = (teamsRes.data as Team[]) ?? [];
      const players = playersRes.data ?? [];
      const attackerSeasons = (attackerRes.data ?? []).map((row) => row.season as string);
      const gkSeasons = (gkRes.data ?? []).map((row) => row.season as string);

      const playersByTeam = new Map<string, number>();
      for (const player of players) {
        playersByTeam.set(player.team_id, (playersByTeam.get(player.team_id) ?? 0) + 1);
      }

      const allSeasons = [
        ...new Set([...teams.map((team) => team.season).filter(Boolean), ...attackerSeasons, ...gkSeasons]),
      ] as string[];

      setSummaries(
        allSeasons
          .sort()
          .reverse()
          .map((season) => {
            const seasonTeams = teams.filter((team) => team.season === season);
            return {
              season,
              teams: seasonTeams,
              playerCount: seasonTeams.reduce((sum, team) => sum + (playersByTeam.get(team.id) ?? 0), 0),
              leagueAttackerRows: attackerSeasons.filter((s) => s === season).length,
              leagueGoalkeeperRows: gkSeasons.filter((s) => s === season).length,
            };
          }),
      );

      const byMonth = new Map<string, number>();
      for (const row of gpsRes.data ?? []) {
        const month = String(row.session_date).slice(0, 7);
        byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
      }
      setMonthlySessions([...byMonth.entries()].sort().map(([mes, sesiones]) => ({ mes, sesiones })));
    });
  }, [orgId]);

  if (summaries === null) return <Skeleton className="h-96 w-full" />;

  if (summaries.length === 0) {
    return (
      <EmptyState
        icon={CalendarRange}
        title="Sin temporadas"
        description="Las temporadas aparecen al importar un roster (equipo + temporada) o estadísticas de liga."
      />
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Temporadas</h1>
        <p className="mt-1 text-sm text-muted-foreground">Resumen por temporada de equipos, plantel y datos de liga</p>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {summaries.map((summary, index) => (
          <Card
            key={summary.season}
            interactive
            className="animate-slide-up"
            style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'backwards' }}
          >
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarRange className="size-4 text-ai" aria-hidden="true" /> Temporada {summary.season}
                </CardTitle>
                <CardDescription className="mt-1">
                  {summary.teams.length > 0
                    ? summary.teams.map((team) => team.name).join(', ')
                    : 'Solo datos de liga (sin equipo propio registrado)'}
                </CardDescription>
              </div>
            </CardHeader>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md bg-panel px-3 py-2.5">
                <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Shield className="size-3" aria-hidden="true" /> Equipos
                </p>
                <p className="mt-1 text-xl font-bold text-foreground">
                  <AnimatedNumber value={summary.teams.length} />
                </p>
              </div>
              <div className="rounded-md bg-panel px-3 py-2.5">
                <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Users className="size-3" aria-hidden="true" /> Jugadores
                </p>
                <p className="mt-1 text-xl font-bold text-foreground">
                  <AnimatedNumber value={summary.playerCount} />
                </p>
              </div>
              <div className="rounded-md bg-panel px-3 py-2.5">
                <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Trophy className="size-3" aria-hidden="true" /> Liga
                </p>
                <p className="mt-1 text-xl font-bold text-foreground">
                  <AnimatedNumber value={summary.leagueAttackerRows + summary.leagueGoalkeeperRows} />
                </p>
              </div>
            </div>
            {(summary.leagueAttackerRows > 0 || summary.leagueGoalkeeperRows > 0) && (
              <div className="mt-3 flex gap-2">
                {summary.leagueAttackerRows > 0 && <Badge variant="ai">{summary.leagueAttackerRows} atacantes de liga</Badge>}
                {summary.leagueGoalkeeperRows > 0 && <Badge variant="purple">{summary.leagueGoalkeeperRows} porteros de liga</Badge>}
              </div>
            )}
          </Card>
        ))}
      </div>

      {monthlySessions.length > 0 && (
        <ChartCard
          title="Actividad GPS por mes"
          description="Sesiones registradas en toda la organización (las sesiones no llevan temporada — se muestran por fecha real)"
        >
          <TrendAreaChart data={monthlySessions} xKey="mes" yKey="sesiones" name="Sesiones" color={colors.green} />
        </ChartCard>
      )}
    </div>
  );
}
