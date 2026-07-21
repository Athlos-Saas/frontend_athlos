import { useEffect, useMemo, useState } from 'react';
import { Pencil, ShieldHalf, Trash2, Trophy } from 'lucide-react';

import { BenchmarkBarChart } from '@/components/charts/BenchmarkBarChart';
import { ComparisonBarChart } from '@/components/charts/ComparisonBarChart';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ChartCard } from '@/components/ui/ChartCard';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { DataTable, type DataTableColumn, type DataTableFilter } from '@/components/tables/DataTable';
import { ImportDialog } from '@/components/import/ImportDialog';
import { ImportHistory } from '@/components/import/ImportHistory';
import { colors } from '@/constants/tokens';
import { supabase } from '@/lib/supabase';
import { parseConferenceStats, validateConferenceStats } from '@/lib/importers/conferenceStats';
import { downloadConferenceTemplate } from '@/lib/importers/templates';
import { matchPlayerId } from '@/lib/importers/nameMatching';
import { toast } from '@/store/toastStore';
import { canWrite } from '@/utils/permissions';
import type { ConferenceBenchmark, LeagueAttackerStat, LeagueGoalkeeperStat, Player } from '@/types/domain';

interface EditableField {
  key: string;
  label: string;
  value: number;
}

interface EditingRow {
  table: 'league_attacker_stats' | 'league_goalkeeper_stats';
  id: string;
  title: string;
  fields: EditableField[];
}

type LoadState = 'loading' | 'error' | 'ready';

const METRIC_LABELS: Record<string, string> = {
  goals_per_game: 'Goles/partido',
  assists_per_game: 'Asist./partido',
  points_per_game: 'Puntos/partido',
  shots_per_game: 'Tiros/partido',
  sh_pct_per_game: '% tiro',
  sog_per_game: 'Tiros a puerta/partido',
  sog_pct_per_game: '% tiro a puerta',
  ga_per_game: 'Goles recibidos/partido',
  gaa: 'GAA',
  saves_per_game: 'Atajadas/partido',
  save_pct: '% atajadas',
};

function metricLabel(metric: string): string {
  return METRIC_LABELS[metric] ?? metric;
}

const ATTACKER_COLUMNS: DataTableColumn<LeagueAttackerStat>[] = [
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

const GOALKEEPER_COLUMNS: DataTableColumn<LeagueGoalkeeperStat>[] = [
  { id: 'player_name', header: 'Jugador', sortable: true, accessor: (row) => row.player_name, className: 'font-medium text-foreground' },
  { id: 'team_name', header: 'Equipo', sortable: true, accessor: (row) => row.team_name },
  { id: 'gaa', header: 'GAA', sortable: true, align: 'right', accessor: (row) => row.gaa ?? 0, cell: (row) => (row.gaa ?? 0).toFixed(2) },
  {
    id: 'save_pct',
    header: '% atajadas',
    sortable: true,
    align: 'right',
    accessor: (row) => row.save_pct ?? 0,
    cell: (row) => `${((row.save_pct ?? 0) * 100).toFixed(1)}%`,
  },
  { id: 'gk_role', header: 'Rol', sortable: true, accessor: (row) => row.gk_role ?? '—' },
];

const BENCHMARK_COLUMNS: DataTableColumn<ConferenceBenchmark>[] = [
  { id: 'metric', header: 'Métrica', accessor: (row) => metricLabel(row.metric), className: 'font-medium text-foreground' },
  { id: 'team_value', header: 'Equipo', align: 'right', accessor: (row) => row.team_value ?? 0, cell: (row) => (row.team_value ?? 0).toFixed(3) },
  { id: 'conference_value', header: 'Conferencia', align: 'right', accessor: (row) => row.conference_value ?? 0, cell: (row) => (row.conference_value ?? 0).toFixed(3) },
  {
    id: 'diff',
    header: 'Diferencia',
    align: 'right',
    accessor: (row) => row.diff ?? 0,
    cell: (row) => {
      const diff = row.diff ?? 0;
      return <span className={diff >= 0 ? 'text-success' : 'text-danger'}>{diff >= 0 ? '+' : ''}{diff.toFixed(3)}</span>;
    },
  },
];

function roleDistribution<T extends { role_name?: string | null; gk_role?: string | null }>(
  rows: T[],
  roleKey: 'role_name' | 'gk_role',
) {
  return Object.entries(
    rows.reduce<Record<string, number>>((accumulator, row) => {
      const role = row[roleKey];
      if (!role) return accumulator;
      accumulator[role] = (accumulator[role] || 0) + 1;
      return accumulator;
    }, {}),
  ).map(([rol, jugadores]) => ({ rol, jugadores }));
}

export default function Liga({ orgId, role }: { orgId: string; role: string | null }) {
  const [season, setSeason] = useState('2025');
  const [competition, setCompetition] = useState('SAC');
  const [homeTeamName, setHomeTeamName] = useState('');
  const [attackers, setAttackers] = useState<LeagueAttackerStat[]>([]);
  const [goalkeepers, setGoalkeepers] = useState<LeagueGoalkeeperStat[]>([]);
  const [attackerBenchmarks, setAttackerBenchmarks] = useState<ConferenceBenchmark[]>([]);
  const [goalkeeperBenchmarks, setGoalkeeperBenchmarks] = useState<ConferenceBenchmark[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [reloadToken, setReloadToken] = useState(0);
  const [editingRow, setEditingRow] = useState<EditingRow | null>(null);

  useEffect(() => {
    let isMounted = true;
    setState('loading');
    Promise.all([
      supabase
        .from('league_attacker_stats')
        .select('id, player_name, team_name, goals, proba_top_scorer, role_name')
        .eq('org_id', orgId)
        .eq('season', season)
        .order('proba_top_scorer', { ascending: false, nullsFirst: false })
        .limit(30),
      supabase
        .from('league_goalkeeper_stats')
        .select('id, player_name, team_name, gaa, save_pct, gk_role')
        .eq('org_id', orgId)
        .eq('season', season)
        .order('gaa', { ascending: true, nullsFirst: false })
        .limit(30),
      supabase
        .from('conference_benchmarks')
        .select('position_group, team_name, metric, team_value, conference_value, diff')
        .eq('org_id', orgId)
        .eq('season', season)
        .eq('position_group', 'attacker'),
      supabase
        .from('conference_benchmarks')
        .select('position_group, team_name, metric, team_value, conference_value, diff')
        .eq('org_id', orgId)
        .eq('season', season)
        .eq('position_group', 'goalkeeper'),
    ]).then(([attackersRes, goalkeepersRes, attackerBenchRes, goalkeeperBenchRes]) => {
      if (!isMounted) return;
      if (attackersRes.error || goalkeepersRes.error || attackerBenchRes.error || goalkeeperBenchRes.error) {
        setState('error');
        return;
      }
      setAttackers(attackersRes.data ?? []);
      setGoalkeepers(goalkeepersRes.data ?? []);
      setAttackerBenchmarks(attackerBenchRes.data ?? []);
      setGoalkeeperBenchmarks(goalkeeperBenchRes.data ?? []);
      setState('ready');
    });
    return () => {
      isMounted = false;
    };
  }, [orgId, season, reloadToken]);

  const attackerRoleCounts = useMemo(() => roleDistribution(attackers, 'role_name'), [attackers]);
  const goalkeeperRoleCounts = useMemo(() => roleDistribution(goalkeepers, 'gk_role'), [goalkeepers]);

  const attackerTeamName = attackerBenchmarks[0]?.team_name;
  const goalkeeperTeamName = goalkeeperBenchmarks[0]?.team_name;

  const roleFilter: DataTableFilter<LeagueAttackerStat> = useMemo(
    () => ({
      columnId: 'role_name',
      label: 'Rol',
      options: [...new Set(attackers.map((row) => row.role_name).filter((role): role is string => Boolean(role)))],
      accessor: (row) => row.role_name ?? '',
    }),
    [attackers],
  );

  const handleConferenceImport = async (parsed: ReturnType<typeof parseConferenceStats>) => {
    const { data: roster, error: rosterError } = await supabase
      .from('players')
      .select('id, full_name')
      .eq('org_id', orgId);
    if (rosterError) throw rosterError;
    const players: Player[] = roster ?? [];

    // Solo se intenta resolver player_id para filas del equipo propio: un
    // rival con el mismo (inicial, apellido) que un jugador propio produce
    // un match falso (dos personas distintas), así que sin homeTeamName no
    // se matchea nada (más seguro que matchear todo).
    const isHomeTeam = (teamName: string) =>
      homeTeamName.trim().length > 0 && teamName.trim().toLowerCase() === homeTeamName.trim().toLowerCase();

    const attackerRows = parsed.attackers.map((row) => ({
      org_id: orgId,
      season,
      competition,
      player_id: isHomeTeam(row.team_name) ? matchPlayerId(row.player_name, players) : null,
      ...row,
    }));
    const goalkeeperRows = parsed.goalkeepers.map((row) => ({
      org_id: orgId,
      season,
      competition,
      player_id: isHomeTeam(row.team_name) ? matchPlayerId(row.player_name, players) : null,
      ...row,
    }));

    if (attackerRows.length > 0) {
      const { error } = await supabase
        .from('league_attacker_stats')
        .upsert(attackerRows, { onConflict: 'org_id,season,competition,player_name,team_name' });
      if (error) throw error;
    }
    if (goalkeeperRows.length > 0) {
      const { error } = await supabase
        .from('league_goalkeeper_stats')
        .upsert(goalkeeperRows, { onConflict: 'org_id,season,competition,player_name,team_name' });
      if (error) throw error;
    }

    setReloadToken((n) => n + 1);
    return {
      written: attackerRows.length + goalkeeperRows.length,
      skipped: 0,
      warnings: ['Los roles y la probabilidad de goleador se calculan aparte, con el entrenamiento del backend.'],
    };
  };

  const handleSaveRow = async (values: Record<string, number>) => {
    if (!editingRow) return;
    const { error } = await supabase.from(editingRow.table).update(values).eq('id', editingRow.id);
    if (error) {
      toast({ title: 'No se pudo guardar', description: error.message, variant: 'danger' });
      return;
    }
    toast({ title: 'Fila actualizada', variant: 'success' });
    setEditingRow(null);
    setReloadToken((n) => n + 1);
  };

  const handleDeleteRow = async (table: EditingRow['table'], id: string) => {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
      toast({ title: 'No se pudo eliminar', description: error.message, variant: 'danger' });
      return;
    }
    toast({ title: 'Fila eliminada', variant: 'success' });
    setReloadToken((n) => n + 1);
  };

  const rowActions = (row: LeagueAttackerStat | LeagueGoalkeeperStat, table: EditingRow['table']) => {
    if (!canWrite(role)) return null;
    const isAttacker = table === 'league_attacker_stats';
    return (
      <div className="flex justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() =>
            setEditingRow(
              isAttacker
                ? { table, id: row.id, title: row.player_name, fields: [{ key: 'goals', label: 'Goles', value: (row as LeagueAttackerStat).goals }] }
                : {
                    table,
                    id: row.id,
                    title: row.player_name,
                    fields: [
                      { key: 'gaa', label: 'GAA', value: (row as LeagueGoalkeeperStat).gaa ?? 0 },
                      { key: 'save_pct', label: '% atajadas (0-1)', value: (row as LeagueGoalkeeperStat).save_pct ?? 0 },
                    ],
                  },
            )
          }
        >
          <Pencil className="size-4" aria-hidden="true" />
          <span className="sr-only">Editar</span>
        </Button>
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="icon">
              <Trash2 className="size-4" aria-hidden="true" />
              <span className="sr-only">Eliminar</span>
            </Button>
          }
          title={`¿Eliminar a ${row.player_name}?`}
          description="Se borra esta fila de stats de liga. No afecta al jugador en el roster ni sus sesiones GPS."
          confirmLabel="Eliminar"
          onConfirm={() => handleDeleteRow(table, row.id)}
        />
      </div>
    );
  };

  if (state === 'error') return <ErrorState onRetry={() => setReloadToken((n) => n + 1)} />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Competiciones · goleadores, porteros y roles</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Clasificador de goleador de élite (AUC 0.891), clustering de roles y rendimiento vs. media de la conferencia
        </p>
      </div>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <Field label="Temporada" htmlFor="season" hint="Formato: YYYY" className="max-w-[160px]">
            <Input id="season" value={season} onChange={(event) => setSeason(event.target.value)} />
          </Field>
          <Field label="Competición" htmlFor="competition" className="max-w-[160px]">
            <Input id="competition" value={competition} onChange={(event) => setCompetition(event.target.value)} />
          </Field>
          {canWrite(role) && (
            <Field
              label="Equipo propio"
              htmlFor="home-team-name"
              hint="Como aparece en la columna Team del Excel, ej. 'John Brown'"
              className="max-w-[220px]"
            >
              <Input id="home-team-name" value={homeTeamName} onChange={(event) => setHomeTeamName(event.target.value)} />
            </Field>
          )}
        </div>
        {canWrite(role) && (
          <ImportDialog
            orgId={orgId}
            triggerLabel="Importar stats de conferencia (Excel)"
            title="Importar stats de conferencia"
            description="Sube el Excel con las hojas Game-Scoring, Game-Shooting, Game-Goalkepeer, Season-Scoring, Season-Shooting, Season-Misc y Season-Goalkepeer. Completa 'Equipo propio' para vincular tus jugadores con sus stats de liga."
            accept=".xlsx"
            expectedKind="conference"
            parse={parseConferenceStats}
            describePreview={(parsed) => `Detecté ${parsed.attackers.length} atacantes y ${parsed.goalkeepers.length} porteros.`}
            validate={validateConferenceStats}
            onConfirm={handleConferenceImport}
            onDownloadTemplate={downloadConferenceTemplate}
          />
        )}
      </div>

      {canWrite(role) && <ImportHistory orgId={orgId} kind="conference" reloadToken={reloadToken} />}

      <Tabs defaultValue="atacantes">
        <TabsList>
          <TabsTrigger value="atacantes">Atacantes</TabsTrigger>
          <TabsTrigger value="porteros">Porteros</TabsTrigger>
        </TabsList>

        <TabsContent value="atacantes">
          {state === 'ready' && attackers.length === 0 ? (
            <EmptyState icon={Trophy} title="Sin estadísticas de atacantes" description="No hay datos para esta temporada todavía." />
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
                  columns={ATTACKER_COLUMNS}
                  data={attackers}
                  getRowId={(row) => row.id}
                  isLoading={state === 'loading'}
                  searchPlaceholder="Buscar jugador o equipo…"
                  filters={roleFilter.options.length > 1 ? [roleFilter] : undefined}
                  exportFileName={`liga-goleadores-${season}.csv`}
                  pageSize={10}
                  rowActions={canWrite(role) ? (row) => rowActions(row, 'league_attacker_stats') : undefined}
                />
              </Card>

              {attackerRoleCounts.length > 0 && (
                <ChartCard title="Distribución de roles (top 30)" isLoading={state === 'loading'} className="mb-5">
                  <ComparisonBarChart data={attackerRoleCounts} xKey="rol" yKey="jugadores" name="Jugadores" color={colors.green} />
                </ChartCard>
              )}

              {attackerBenchmarks.length > 0 && (
                <>
                  <ChartCard
                    title="Rendimiento vs. conferencia"
                    description={attackerTeamName ? `${attackerTeamName} vs. media del resto de la conferencia` : undefined}
                    isLoading={state === 'loading'}
                    className="mb-5"
                  >
                    <BenchmarkBarChart
                      data={attackerBenchmarks.map((row) => ({ metric: metricLabel(row.metric), team_value: row.team_value, conference_value: row.conference_value }))}
                      teamLabel={attackerTeamName ?? 'Equipo'}
                    />
                  </ChartCard>
                  <Card>
                    <CardHeader>
                      <CardTitle>Detalle equipo vs. conferencia</CardTitle>
                    </CardHeader>
                    <DataTable
                      columns={BENCHMARK_COLUMNS}
                      data={attackerBenchmarks}
                      getRowId={(row) => row.metric}
                      isLoading={state === 'loading'}
                      searchable={false}
                      pageSize={10}
                    />
                  </Card>
                </>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="porteros">
          {state === 'ready' && goalkeepers.length === 0 ? (
            <EmptyState icon={ShieldHalf} title="Sin estadísticas de porteros" description="No hay datos para esta temporada todavía." />
          ) : (
            <>
              <Card className="mb-5">
                <CardHeader>
                  <div>
                    <CardTitle>Porteros por GAA (goles recibidos por partido)</CardTitle>
                    <CardDescription className="mt-1">Temporada {season}</CardDescription>
                  </div>
                </CardHeader>
                <DataTable
                  columns={GOALKEEPER_COLUMNS}
                  data={goalkeepers}
                  getRowId={(row) => row.id}
                  isLoading={state === 'loading'}
                  searchPlaceholder="Buscar jugador o equipo…"
                  exportFileName={`liga-porteros-${season}.csv`}
                  pageSize={10}
                  rowActions={canWrite(role) ? (row) => rowActions(row, 'league_goalkeeper_stats') : undefined}
                />
              </Card>

              {goalkeeperRoleCounts.length > 0 && (
                <ChartCard title="Distribución de roles de portero" isLoading={state === 'loading'} className="mb-5">
                  <ComparisonBarChart data={goalkeeperRoleCounts} xKey="rol" yKey="jugadores" name="Porteros" color={colors.blue} />
                </ChartCard>
              )}

              {goalkeeperBenchmarks.length > 0 && (
                <>
                  <ChartCard
                    title="Rendimiento vs. conferencia"
                    description={goalkeeperTeamName ? `${goalkeeperTeamName} vs. media del resto de la conferencia` : undefined}
                    isLoading={state === 'loading'}
                    className="mb-5"
                  >
                    <BenchmarkBarChart
                      data={goalkeeperBenchmarks.map((row) => ({ metric: metricLabel(row.metric), team_value: row.team_value, conference_value: row.conference_value }))}
                      teamLabel={goalkeeperTeamName ?? 'Equipo'}
                    />
                  </ChartCard>
                  <Card>
                    <CardHeader>
                      <CardTitle>Detalle equipo vs. conferencia</CardTitle>
                    </CardHeader>
                    <DataTable
                      columns={BENCHMARK_COLUMNS}
                      data={goalkeeperBenchmarks}
                      getRowId={(row) => row.metric}
                      isLoading={state === 'loading'}
                      searchable={false}
                      pageSize={10}
                    />
                  </Card>
                </>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      <EditRowDialog editingRow={editingRow} onClose={() => setEditingRow(null)} onSave={handleSaveRow} />
    </div>
  );
}

function EditRowDialog({
  editingRow,
  onClose,
  onSave,
}: {
  editingRow: EditingRow | null;
  onClose: () => void;
  onSave: (values: Record<string, number>) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (editingRow) {
      setValues(Object.fromEntries(editingRow.fields.map((field) => [field.key, String(field.value)])));
    }
  }, [editingRow]);

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Number(value)])));
    setIsSaving(false);
  };

  return (
    <Dialog open={!!editingRow} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar {editingRow?.title}</DialogTitle>
        </DialogHeader>
        {editingRow?.fields.map((field) => (
          <Field key={field.key} label={field.label} htmlFor={`edit-${field.key}`}>
            <Input
              id={`edit-${field.key}`}
              type="number"
              step="any"
              value={values[field.key] ?? ''}
              onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
            />
          </Field>
        ))}
        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" isLoading={isSaving} onClick={handleSave}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
