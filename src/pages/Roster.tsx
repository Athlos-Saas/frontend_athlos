import { useEffect, useMemo, useState } from 'react';
import { Pencil, Power, UserRound } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip';
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable';
import { ImportDialog } from '@/components/import/ImportDialog';
import { ImportHistory } from '@/components/import/ImportHistory';
import { supabase } from '@/lib/supabase';
import { getOrCreatePlayers } from '@/lib/importers/playerLookup';
import { parseRoster, validateRoster, type ParsedRoster } from '@/lib/importers/roster';
import { downloadRosterTemplate } from '@/lib/importers/templates';
import { useTeamSelection } from '@/lib/importers/useTeamSelection';
import { toast } from '@/store/toastStore';
import { canWrite } from '@/utils/permissions';
import type { Injury, Player } from '@/types/domain';

type LoadState = 'loading' | 'error' | 'ready';

interface LeagueSummary {
  kind: 'attacker' | 'goalkeeper';
  goals?: number;
  role_name?: string | null;
  gaa?: number;
  gk_role?: string | null;
}

interface RosterRow extends Player {
  injury?: Injury;
  league?: LeagueSummary;
}

function leagueSummaryText(summary?: LeagueSummary): string {
  if (!summary) return '—';
  if (summary.kind === 'attacker') return `${summary.goals ?? 0} goles · ${summary.role_name ?? '—'}`;
  return `GAA ${(summary.gaa ?? 0).toFixed(2)} · ${summary.gk_role ?? '—'}`;
}

function ageFromBirthdate(birthdate?: string | null): number | null {
  if (!birthdate) return null;
  const born = new Date(birthdate);
  if (Number.isNaN(born.getTime())) return null;
  const diff = Date.now() - born.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

const SEVERITY_VARIANT: Record<Injury['severity'], 'warning' | 'danger'> = {
  minor: 'warning',
  moderate: 'warning',
  severe: 'danger',
};

function buildColumns(
  canEdit: boolean,
  onMarkRecovered: (injury: Injury) => void,
  onDeleteInjury: (injury: Injury) => void,
): DataTableColumn<RosterRow>[] {
  return [
    { id: 'full_name', header: 'Jugador', sortable: true, accessor: (row) => row.full_name, className: 'font-medium text-foreground' },
    { id: 'position', header: 'Posición', sortable: true, accessor: (row) => row.position ?? '—' },
    { id: 'height_cm', header: 'Altura (cm)', align: 'right', sortable: true, accessor: (row) => row.height_cm ?? 0, cell: (row) => (row.height_cm ? row.height_cm.toFixed(0) : '—') },
    { id: 'weight_kg', header: 'Peso (kg)', align: 'right', sortable: true, accessor: (row) => row.weight_kg ?? 0, cell: (row) => (row.weight_kg ? row.weight_kg.toFixed(0) : '—') },
    { id: 'age', header: 'Edad', align: 'right', sortable: true, accessor: (row) => ageFromBirthdate(row.birthdate) ?? 0, cell: (row) => ageFromBirthdate(row.birthdate) ?? '—' },
    { id: 'league', header: 'Liga', accessor: (row) => leagueSummaryText(row.league) },
    {
      id: 'injury',
      header: 'Estado',
      accessor: (row) => (row.injury ? row.injury.severity : 'ok'),
      cell: (row) => {
        if (!row.injury) return <Badge variant="success">Disponible</Badge>;
        const badge = (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant={SEVERITY_VARIANT[row.injury.severity]} className={canEdit ? 'cursor-pointer' : undefined}>
                Lesionado
              </Badge>
            </TooltipTrigger>
            <TooltipContent>{row.injury.notes ?? 'Sin detalle'}</TooltipContent>
          </Tooltip>
        );
        if (!canEdit) return <TooltipProvider>{badge}</TooltipProvider>;
        return (
          <TooltipProvider>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>{badge}</DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => onMarkRecovered(row.injury as Injury)}>Marcar recuperado</DropdownMenuItem>
                <DropdownMenuItem destructive onClick={() => onDeleteInjury(row.injury as Injury)}>
                  Eliminar registro
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TooltipProvider>
        );
      },
    },
  ];
}

export default function Roster({ orgId, role }: { orgId: string; role: string | null }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [leagueAttackers, setLeagueAttackers] = useState<{ player_id: string; goals: number; role_name: string | null }[]>([]);
  const [leagueGoalkeepers, setLeagueGoalkeepers] = useState<{ player_id: string; gaa: number; gk_role: string | null }[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [reloadToken, setReloadToken] = useState(0);
  const [editingPlayer, setEditingPlayer] = useState<RosterRow | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const { teams, teamId, setTeamId } = useTeamSelection(orgId);

  useEffect(() => {
    let isMounted = true;
    setState('loading');
    Promise.all([
      supabase
        .from('players')
        .select('id, full_name, position, height_cm, weight_kg, birthdate')
        .eq('org_id', orgId)
        .eq('is_active', !showInactive)
        .order('full_name'),
      supabase.from('injuries').select('id, player_id, severity, notes').eq('org_id', orgId).is('return_date', null),
      supabase
        .from('league_attacker_stats')
        .select('player_id, goals, role_name')
        .eq('org_id', orgId)
        .not('player_id', 'is', null),
      supabase
        .from('league_goalkeeper_stats')
        .select('player_id, gaa, gk_role')
        .eq('org_id', orgId)
        .not('player_id', 'is', null),
    ]).then(([playersRes, injuriesRes, attackersRes, goalkeepersRes]) => {
      if (!isMounted) return;
      if (playersRes.error || injuriesRes.error || attackersRes.error || goalkeepersRes.error) {
        setState('error');
        return;
      }
      setPlayers(playersRes.data ?? []);
      setInjuries(injuriesRes.data ?? []);
      setLeagueAttackers(attackersRes.data ?? []);
      setLeagueGoalkeepers(goalkeepersRes.data ?? []);
      setState('ready');
    });
    return () => {
      isMounted = false;
    };
  }, [orgId, reloadToken, showInactive]);

  const rows: RosterRow[] = useMemo(() => {
    const injuryByPlayer = new Map(injuries.map((injury) => [injury.player_id, injury]));
    const attackerByPlayer = new Map(
      leagueAttackers.map((row) => [row.player_id, { kind: 'attacker' as const, goals: row.goals, role_name: row.role_name }]),
    );
    const goalkeeperByPlayer = new Map(
      leagueGoalkeepers.map((row) => [row.player_id, { kind: 'goalkeeper' as const, gaa: row.gaa, gk_role: row.gk_role }]),
    );
    return players.map((player) => ({
      ...player,
      injury: injuryByPlayer.get(player.id),
      league: attackerByPlayer.get(player.id) ?? goalkeeperByPlayer.get(player.id),
    }));
  }, [players, injuries, leagueAttackers, leagueGoalkeepers]);

  const season = teams.find((team) => team.id === teamId)?.season ?? String(new Date().getFullYear());

  const handleRosterImport = async (parsed: ParsedRoster) => {
    const names = parsed.players.map((player) => player.full_name);
    const nameToId = await getOrCreatePlayers(orgId, teamId, names);

    let written = 0;
    let skipped = 0;
    for (const player of parsed.players) {
      const playerId = nameToId[player.full_name];
      if (!playerId) {
        skipped += 1;
        continue;
      }
      const { error } = await supabase
        .from('players')
        .update({
          position: player.position,
          height_cm: player.height_cm,
          weight_kg: player.weight_kg,
          birthdate: player.birthdate,
        })
        .eq('id', playerId);
      if (error) throw error;
      written += 1;
    }

    const injuryRows = parsed.injuries
      .map((injury) => ({
        org_id: orgId,
        player_id: nameToId[injury.full_name],
        injury_date: injury.injury_date,
        return_date: injury.return_date,
        severity: injury.severity,
        notes: injury.notes,
      }))
      .filter((row) => row.player_id);
    if (injuryRows.length > 0) {
      const { error } = await supabase.from('injuries').insert(injuryRows);
      if (error) throw error;
    }

    setReloadToken((n) => n + 1);
    return {
      written,
      skipped,
      warnings: injuryRows.length > 0 ? [`${injuryRows.length} lesiones registradas.`] : [],
    };
  };

  const handleSavePlayer = async (updated: { position: string | null; height_cm: number | null; weight_kg: number | null; birthdate: string | null }) => {
    if (!editingPlayer) return;
    const { error } = await supabase.from('players').update(updated).eq('id', editingPlayer.id);
    if (error) {
      toast({ title: 'No se pudo guardar', description: error.message, variant: 'danger' });
      return;
    }
    toast({ title: 'Jugador actualizado', variant: 'success' });
    setEditingPlayer(null);
    setReloadToken((n) => n + 1);
  };

  const handleDeactivate = async (player: RosterRow) => {
    const { error } = await supabase.from('players').update({ is_active: false }).eq('id', player.id);
    if (error) {
      toast({ title: 'No se pudo desactivar', description: error.message, variant: 'danger' });
      return;
    }
    toast({ title: `${player.full_name} desactivado`, variant: 'success' });
    setReloadToken((n) => n + 1);
  };

  const handleReactivate = async (player: RosterRow) => {
    const { error } = await supabase.from('players').update({ is_active: true }).eq('id', player.id);
    if (error) {
      toast({ title: 'No se pudo reactivar', description: error.message, variant: 'danger' });
      return;
    }
    toast({ title: `${player.full_name} reactivado`, variant: 'success' });
    setReloadToken((n) => n + 1);
  };

  const handleMarkRecovered = async (injury: Injury) => {
    const { error } = await supabase
      .from('injuries')
      .update({ return_date: new Date().toISOString().slice(0, 10) })
      .eq('id', injury.id);
    if (error) {
      toast({ title: 'No se pudo actualizar', description: error.message, variant: 'danger' });
      return;
    }
    toast({ title: 'Lesión marcada como recuperada', variant: 'success' });
    setReloadToken((n) => n + 1);
  };

  const handleDeleteInjury = async (injury: Injury) => {
    const { error } = await supabase.from('injuries').delete().eq('id', injury.id);
    if (error) {
      toast({ title: 'No se pudo eliminar', description: error.message, variant: 'danger' });
      return;
    }
    toast({ title: 'Registro de lesión eliminado', variant: 'success' });
    setReloadToken((n) => n + 1);
  };

  const columns = useMemo(
    () => buildColumns(canWrite(role), handleMarkRecovered, handleDeleteInjury),
    [role],
  );

  if (state === 'error') return <ErrorState onRetry={() => setReloadToken((n) => n + 1)} />;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Roster físico</h1>
          <p className="mt-1 text-sm text-muted-foreground">Posición, altura, peso y estado de lesión por jugador</p>
        </div>
        {canWrite(role) && (
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={showInactive} onCheckedChange={setShowInactive} />
              Ver inactivos
            </label>
            {teams.length > 1 && (
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Equipo" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name} · {team.season}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <ImportDialog
              orgId={orgId}
              triggerLabel="Importar roster (Excel)"
              title="Importar roster físico"
              description="Sube el Excel con columnas Name/Position/Weight/Height/Age/Recent injuries."
              accept=".xlsx"
              expectedKind="roster"
              disabled={!teamId}
              parse={(workbook) => parseRoster(workbook, season)}
              describePreview={(parsed) =>
                `Detecté ${parsed.players.length} jugadores y ${parsed.injuries.length} lesiones.`
              }
              validate={validateRoster}
              onConfirm={handleRosterImport}
              onDownloadTemplate={downloadRosterTemplate}
            />
          </div>
        )}
      </div>

      {canWrite(role) && <ImportHistory orgId={orgId} kind="roster" reloadToken={reloadToken} />}

      {state === 'ready' && rows.length === 0 ? (
        <EmptyState icon={UserRound} title="Sin roster todavía" description="Corre el seed con --roster en el backend." />
      ) : (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Jugadores</CardTitle>
              <CardDescription className="mt-1">{rows.length} jugadores registrados</CardDescription>
            </div>
          </CardHeader>
          <DataTable
            columns={columns}
            data={rows}
            getRowId={(row) => row.id}
            isLoading={state === 'loading'}
            searchPlaceholder="Buscar jugador…"
            exportFileName="roster-fisico.csv"
            pageSize={15}
            showRowNumber
            rowActions={
              !canWrite(role)
                ? undefined
                : showInactive
                  ? (row) => (
                      <Button variant="ghost" size="sm" onClick={() => handleReactivate(row)}>
                        <Power className="size-4" aria-hidden="true" /> Reactivar
                      </Button>
                    )
                  : (row) => (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditingPlayer(row)}>
                          <Pencil className="size-4" aria-hidden="true" />
                          <span className="sr-only">Editar</span>
                        </Button>
                        <ConfirmDialog
                          trigger={
                            <Button variant="ghost" size="icon">
                              <Power className="size-4" aria-hidden="true" />
                              <span className="sr-only">Desactivar</span>
                            </Button>
                          }
                          title={`¿Desactivar a ${row.full_name}?`}
                          description="Deja de aparecer en el roster activo; sus datos históricos (sesiones, stats) no se borran."
                          confirmLabel="Desactivar"
                          onConfirm={() => handleDeactivate(row)}
                        />
                      </div>
                    )
            }
          />
        </Card>
      )}

      <EditPlayerDialog player={editingPlayer} onClose={() => setEditingPlayer(null)} onSave={handleSavePlayer} />
    </div>
  );
}

function EditPlayerDialog({
  player,
  onClose,
  onSave,
}: {
  player: RosterRow | null;
  onClose: () => void;
  onSave: (updated: { position: string | null; height_cm: number | null; weight_kg: number | null; birthdate: string | null }) => Promise<void>;
}) {
  const [form, setForm] = useState({ position: '', height_cm: '', weight_kg: '', birthdate: '' });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (player) {
      setForm({
        position: player.position ?? '',
        height_cm: player.height_cm?.toString() ?? '',
        weight_kg: player.weight_kg?.toString() ?? '',
        birthdate: player.birthdate ?? '',
      });
    }
  }, [player]);

  const handleSave = async () => {
    setIsSaving(true);
    await onSave({
      position: form.position || null,
      height_cm: form.height_cm ? Number(form.height_cm) : null,
      weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
      birthdate: form.birthdate || null,
    });
    setIsSaving(false);
  };

  return (
    <Dialog open={!!player} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar {player?.full_name}</DialogTitle>
        </DialogHeader>
        <Field label="Posición" htmlFor="edit-position">
          <Input id="edit-position" value={form.position} onChange={(event) => setForm((f) => ({ ...f, position: event.target.value }))} />
        </Field>
        <Field label="Altura (cm)" htmlFor="edit-height">
          <Input
            id="edit-height"
            type="number"
            value={form.height_cm}
            onChange={(event) => setForm((f) => ({ ...f, height_cm: event.target.value }))}
          />
        </Field>
        <Field label="Peso (kg)" htmlFor="edit-weight">
          <Input
            id="edit-weight"
            type="number"
            value={form.weight_kg}
            onChange={(event) => setForm((f) => ({ ...f, weight_kg: event.target.value }))}
          />
        </Field>
        <Field label="Fecha de nacimiento" htmlFor="edit-birthdate">
          <Input
            id="edit-birthdate"
            type="date"
            value={form.birthdate}
            onChange={(event) => setForm((f) => ({ ...f, birthdate: event.target.value }))}
          />
        </Field>
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
