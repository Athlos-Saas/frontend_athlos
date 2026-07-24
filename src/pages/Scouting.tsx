import { useEffect, useMemo, useState } from 'react';
import { Radar, ShieldHalf, Target } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { usePagedRows } from '@/hooks/usePagedRows';
import { supabase } from '@/lib/supabase';
import { toast } from '@/store/toastStore';
import type { LeagueAttackerStat, LeagueGoalkeeperStat } from '@/types/domain';

/** Barra de probabilidad inline para celdas de tabla. */
function ProbabilityCell({ value, gradient }: { value: number | null; gradient: string }) {
  if (value === null) return <span className="text-muted-foreground">--</span>;
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-border/60">
        <div className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-[width] duration-700 ease-out`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-sm font-semibold text-foreground">{pct}%</span>
    </div>
  );
}

/**
 * Scouting = ranking de prospectos de la liga a partir de las señales ML que
 * ya existen (proba_top_scorer del clasificador + clusters de rol). Todo sale
 * de league_attacker_stats / league_goalkeeper_stats — nada inventado.
 */
export default function Scouting({ orgId }: { orgId: string }) {
  const [attackers, setAttackers] = useState<LeagueAttackerStat[] | null>(null);
  const [goalkeepers, setGoalkeepers] = useState<LeagueGoalkeeperStat[]>([]);
  const [season, setSeason] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [teamSearch, setTeamSearch] = useState('');

  useEffect(() => {
    Promise.all([
      supabase
        .from('league_attacker_stats')
        .select('id, season, player_name, team_name, gp, goals, points, proba_top_scorer, role_name')
        .eq('org_id', orgId)
        .order('proba_top_scorer', { ascending: false, nullsFirst: false }),
      supabase
        .from('league_goalkeeper_stats')
        .select('id, season, player_name, team_name, gp, gaa, save_pct, gk_role')
        .eq('org_id', orgId)
        .order('save_pct', { ascending: false, nullsFirst: false }),
    ]).then(([attackersRes, goalkeepersRes]) => {
      if (attackersRes.error) {
        toast({ title: 'No se pudo cargar scouting', description: attackersRes.error.message, variant: 'danger' });
        setAttackers([]);
        return;
      }
      const rows = (attackersRes.data as LeagueAttackerStat[]) ?? [];
      setAttackers(rows);
      setGoalkeepers((goalkeepersRes.data as LeagueGoalkeeperStat[]) ?? []);
      const seasons = [...new Set(rows.map((row) => row.season).filter(Boolean))] as string[];
      if (seasons.length > 0) setSeason(seasons.sort().reverse()[0]);
    });
  }, [orgId]);

  const seasons = useMemo(
    () => [...new Set((attackers ?? []).map((row) => row.season).filter(Boolean))].sort().reverse() as string[],
    [attackers],
  );
  const roles = useMemo(
    () => [...new Set((attackers ?? []).map((row) => row.role_name).filter(Boolean))] as string[],
    [attackers],
  );

  const prospects = useMemo(
    () =>
      (attackers ?? [])
        .filter((row) => !season || row.season === season)
        .filter((row) => roleFilter === 'all' || row.role_name === roleFilter)
        .filter((row) => !teamSearch || row.team_name.toLowerCase().includes(teamSearch.toLowerCase()))
        .filter((row) => row.proba_top_scorer !== null),
    [attackers, season, roleFilter, teamSearch],
  );

  const keepers = useMemo(
    () =>
      goalkeepers
        .filter((row) => !season || row.season === season)
        .filter((row) => !teamSearch || row.team_name.toLowerCase().includes(teamSearch.toLowerCase()))
        .filter((row) => row.save_pct !== null),
    [goalkeepers, season, teamSearch],
  );

  const prospectsPager = usePagedRows(prospects, 10);
  const keepersPager = usePagedRows(keepers, 10);

  if (attackers === null) return <Skeleton className="h-96 w-full" />;

  if (attackers.length === 0 && goalkeepers.length === 0) {
    return (
      <EmptyState
        icon={Radar}
        title="Sin datos de scouting"
        description="Importa estadísticas de conferencia y reentrena los modelos técnicos para generar los rankings."
      />
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Scouting</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Prospectos de la liga rankeados por los modelos de IA (probabilidad de goleador élite y roles)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {seasons.length > 0 && (
            <Select value={season} onValueChange={setSeason}>
              <SelectTrigger className="h-9 w-32">
                <SelectValue placeholder="Temporada" />
              </SelectTrigger>
              <SelectContent>
                {seasons.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {roles.length > 0 && (
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-9 w-44">
                <SelectValue placeholder="Rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Input
            value={teamSearch}
            onChange={(event) => setTeamSearch(event.target.value)}
            placeholder="Filtrar por equipo…"
            className="h-9 w-44"
          />
        </div>
      </div>

      <Card className="mb-5">
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="size-4 text-ai" aria-hidden="true" /> Prospectos ofensivos
            </CardTitle>
            <CardDescription className="mt-1">
              {prospects.length} jugadores · ordenados por probabilidad de goleador élite (clasificador entrenado con datos de la liga)
            </CardDescription>
          </div>
        </CardHeader>
        {prospects.length === 0 ? (
          <EmptyState title="Sin resultados" description="Ningún jugador coincide con los filtros actuales." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Jugador</TableHead>
                  <TableHead>Equipo</TableHead>
                  <TableHead className="text-right">PJ</TableHead>
                  <TableHead className="text-right">Goles</TableHead>
                  <TableHead className="text-right">Pts</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead className="text-right">Prob. élite</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prospectsPager.paged.map((prospect, index) => {
                  const rank = (prospectsPager.page - 1) * 10 + index + 1;
                  return (
                    <TableRow
                      key={prospect.id}
                      className="animate-slide-up"
                      style={{ animationDelay: `${Math.min(index * 35, 350)}ms`, animationFillMode: 'backwards' }}
                    >
                      <TableCell className="font-bold text-muted-foreground">{rank}</TableCell>
                      <TableCell className="font-medium text-foreground">{prospect.player_name}</TableCell>
                      <TableCell className="text-muted-foreground">{prospect.team_name}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{prospect.gp ?? '--'}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{prospect.goals}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{prospect.points ?? '--'}</TableCell>
                      <TableCell>{prospect.role_name ? <Badge variant="purple">{prospect.role_name}</Badge> : '--'}</TableCell>
                      <TableCell>
                        <ProbabilityCell value={prospect.proba_top_scorer} gradient="from-ai to-purple" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Pagination page={prospectsPager.page} pageCount={prospectsPager.pageCount} onPageChange={prospectsPager.setPage} className="mt-4" />
          </>
        )}
      </Card>

      {keepers.length > 0 && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldHalf className="size-4 text-ai" aria-hidden="true" /> Porteros
              </CardTitle>
              <CardDescription className="mt-1">{keepers.length} porteros · ordenados por porcentaje de atajadas</CardDescription>
            </div>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Jugador</TableHead>
                <TableHead>Equipo</TableHead>
                <TableHead className="text-right">PJ</TableHead>
                <TableHead className="text-right">GAA</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="text-right">% atajadas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keepersPager.paged.map((keeper, index) => {
                const rank = (keepersPager.page - 1) * 10 + index + 1;
                return (
                  <TableRow
                    key={keeper.id}
                    className="animate-slide-up"
                    style={{ animationDelay: `${Math.min(index * 35, 350)}ms`, animationFillMode: 'backwards' }}
                  >
                    <TableCell className="font-bold text-muted-foreground">{rank}</TableCell>
                    <TableCell className="font-medium text-foreground">{keeper.player_name}</TableCell>
                    <TableCell className="text-muted-foreground">{keeper.team_name}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{keeper.gp ?? '--'}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {keeper.gaa != null ? Number(keeper.gaa).toFixed(2) : '--'}
                    </TableCell>
                    <TableCell>{keeper.gk_role ? <Badge variant="ai">{keeper.gk_role}</Badge> : '--'}</TableCell>
                    <TableCell>
                      <ProbabilityCell value={keeper.save_pct} gradient="from-success to-ai" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Pagination page={keepersPager.page} pageCount={keepersPager.pageCount} onPageChange={keepersPager.setPage} className="mt-4" />
        </Card>
      )}
    </div>
  );
}
