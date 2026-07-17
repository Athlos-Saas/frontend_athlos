import { useEffect, useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';

import { ComparisonBarChart } from '@/components/charts/ComparisonBarChart';
import { Badge } from '@/components/ui/Badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ChartCard } from '@/components/ui/ChartCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { DataTable, type DataTableColumn, type DataTableFilter } from '@/components/tables/DataTable';
import { colors } from '@/constants/tokens';
import { supabase } from '@/lib/supabase';
import type { LeagueAttackerStat } from '@/types/domain';

type LoadState = 'loading' | 'error' | 'ready';

const COLUMNS: DataTableColumn<LeagueAttackerStat>[] = [
  { id: 'player_name', header: 'Jugador', sortable: true, accessor: (row) => row.player_name, className: 'font-medium text-foreground' },
  { id: 'team_name', header: 'Equipo', sortable: true, accessor: (row) => row.team_name },
  { id: 'goals', header: 'Goles', sortable: true, align: 'right', accessor: (row) => row.goals },
  {
    id: 'proba_top_scorer',
    header: 'Prob. élite',
    sortable: true,
    align: 'right',
    accessor: (row) => row.proba_top_scorer ?? 0,
    cell: (row) => (
      <Badge variant={Number(row.proba_top_scorer) >= 0.5 ? 'success' : 'ai'}>
        {(Number(row.proba_top_scorer ?? 0) * 100).toFixed(1)}%
      </Badge>
    ),
  },
  { id: 'role_name', header: 'Rol', sortable: true, accessor: (row) => row.role_name ?? '—' },
];

export default function Liga({ orgId }: { orgId: string }) {
  const [season, setSeason] = useState('2025');
  const [attackers, setAttackers] = useState<LeagueAttackerStat[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setState('loading');
    supabase
      .from('league_attacker_stats')
      .select('player_name, team_name, goals, proba_top_scorer, role_name')
      .eq('org_id', orgId)
      .eq('season', season)
      .order('proba_top_scorer', { ascending: false, nullsFirst: false })
      .limit(30)
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          setState('error');
          return;
        }
        setAttackers(data ?? []);
        setState('ready');
      });
    return () => {
      isMounted = false;
    };
  }, [orgId, season, reloadToken]);

  const roleCounts = useMemo(
    () =>
      Object.entries(
        attackers.reduce<Record<string, number>>((accumulator, row) => {
          if (!row.role_name) return accumulator;
          accumulator[row.role_name] = (accumulator[row.role_name] || 0) + 1;
          return accumulator;
        }, {}),
      ).map(([rol, jugadores]) => ({ rol, jugadores })),
    [attackers],
  );

  const roleFilter: DataTableFilter<LeagueAttackerStat> = useMemo(
    () => ({
      columnId: 'role_name',
      label: 'Rol',
      options: [...new Set(attackers.map((row) => row.role_name).filter((role): role is string => Boolean(role)))],
      accessor: (row) => row.role_name ?? '',
    }),
    [attackers],
  );

  if (state === 'error') return <ErrorState onRetry={() => setReloadToken((n) => n + 1)} />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Competiciones · goleadores y roles</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Clasificador de goleador de élite (AUC 0.891) y clustering de roles ofensivos
        </p>
      </div>

      <Field label="Temporada" htmlFor="season" hint="Formato: YYYY" className="mb-5 max-w-[160px]">
        <Input id="season" value={season} onChange={(event) => setSeason(event.target.value)} />
      </Field>

      {state === 'ready' && attackers.length === 0 ? (
        <EmptyState icon={Trophy} title="Sin estadísticas de liga" description="No hay datos para esta temporada todavía." />
      ) : (
        <>
          <Card className="mb-5">
            <CardHeader>
              <div>
                <CardTitle>Top 30 por probabilidad de goleador de élite</CardTitle>
                <CardDescription className="mt-1">Temporada {season}</CardDescription>
              </div>
            </CardHeader>
            <DataTable
              columns={COLUMNS}
              data={attackers}
              getRowId={(row) => `${row.player_name}-${row.team_name}`}
              isLoading={state === 'loading'}
              searchPlaceholder="Buscar jugador o equipo…"
              filters={roleFilter.options.length > 1 ? [roleFilter] : undefined}
              exportFileName={`liga-goleadores-${season}.csv`}
              pageSize={10}
            />
          </Card>

          {roleCounts.length > 0 && (
            <ChartCard title="Distribución de roles (top 30)" isLoading={state === 'loading'}>
              <ComparisonBarChart data={roleCounts} xKey="rol" yKey="jugadores" name="Jugadores" color={colors.green} />
            </ChartCard>
          )}
        </>
      )}
    </div>
  );
}
