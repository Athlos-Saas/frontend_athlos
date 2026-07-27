import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Pencil, Power, UserRound, UserSearch } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip';
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable';
import { EditPlayerDialog, type PlayerUpdate } from '@/components/players/EditPlayerDialog';
import { ImportDialog } from '@/components/import/ImportDialog';
import { ImportHistory } from '@/components/import/ImportHistory';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { supabase } from '@/lib/supabase';
import { getOrCreatePlayers } from '@/lib/importers/playerLookup';
import { parseRoster, validateRoster, type ParsedRoster } from '@/lib/importers/roster';
import { downloadRosterTemplate } from '@/lib/importers/templates';
import { uploadPlayerPhoto } from '@/features/playerProfile/mediaStorage';
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

function leagueSummaryText(t: TFunction, summary?: LeagueSummary): string {
  if (!summary) return '—';
  if (summary.kind === 'attacker') {
    return t('roster.league.attackerSummary', '{{goals}} goles · {{role}}', {
      goals: summary.goals ?? 0,
      role: summary.role_name ?? '—',
    });
  }
  return t('roster.league.goalkeeperSummary', 'GAA {{gaa}} · {{role}}', {
    gaa: (summary.gaa ?? 0).toFixed(2),
    role: summary.gk_role ?? '—',
  });
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
  t: TFunction,
  canEdit: boolean,
  onMarkRecovered: (injury: Injury) => void,
  onDeleteInjury: (injury: Injury) => void,
  onOpenProfile: (playerId: string) => void,
): DataTableColumn<RosterRow>[] {
  return [
    {
      id: 'full_name',
      header: t('roster.col.fullName', 'Jugador'),
      sortable: true,
      accessor: (row) => row.full_name,
      className: 'font-medium text-foreground',
      cell: (row) => (
        <button
          type="button"
          onClick={() => onOpenProfile(row.id)}
          className="focus-ring rounded-sm text-left font-medium text-foreground hover:text-ai hover:underline"
        >
          {row.full_name}
        </button>
      ),
    },
    { id: 'position', header: t('roster.col.position', 'Posición'), sortable: true, accessor: (row) => row.position ?? '—' },
    { id: 'height_cm', header: t('roster.col.height', 'Altura (cm)'), align: 'right', sortable: true, accessor: (row) => row.height_cm ?? 0, cell: (row) => (row.height_cm ? row.height_cm.toFixed(0) : '—') },
    { id: 'weight_kg', header: t('roster.col.weight', 'Peso (kg)'), align: 'right', sortable: true, accessor: (row) => row.weight_kg ?? 0, cell: (row) => (row.weight_kg ? row.weight_kg.toFixed(0) : '—') },
    { id: 'age', header: t('roster.col.age', 'Edad'), align: 'right', sortable: true, accessor: (row) => ageFromBirthdate(row.birthdate) ?? 0, cell: (row) => ageFromBirthdate(row.birthdate) ?? '—' },
    { id: 'league', header: t('roster.col.league', 'Liga'), accessor: (row) => leagueSummaryText(t, row.league) },
    {
      id: 'injury',
      header: t('roster.col.status', 'Estado'),
      accessor: (row) => (row.injury ? row.injury.severity : 'ok'),
      cell: (row) => {
        if (!row.injury) return <Badge variant="success">{t('roster.status.available', 'Disponible')}</Badge>;
        const badge = (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant={SEVERITY_VARIANT[row.injury.severity]} className={canEdit ? 'cursor-pointer' : undefined}>
                {t('roster.status.injured', 'Lesionado')}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>{row.injury.notes ?? t('roster.status.noDetail', 'Sin detalle')}</TooltipContent>
          </Tooltip>
        );
        if (!canEdit) return <TooltipProvider>{badge}</TooltipProvider>;
        return (
          <TooltipProvider>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>{badge}</DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => onMarkRecovered(row.injury as Injury)}>
                  {t('roster.status.markRecovered', 'Marcar recuperado')}
                </DropdownMenuItem>
                <DropdownMenuItem destructive onClick={() => onDeleteInjury(row.injury as Injury)}>
                  {t('roster.status.deleteRecord', 'Eliminar registro')}
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
  const navigate = useNavigate();
  const { t } = useTranslation();
  useScrollRestoration('roster');
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
        .select('id, full_name, position, height_cm, weight_kg, birthdate, photo_url')
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
      warnings:
        injuryRows.length > 0
          ? [t('roster.import.injuriesRegistered', '{{count}} lesiones registradas.', { count: injuryRows.length })]
          : [],
    };
  };

  const handleSavePlayer = async (updated: PlayerUpdate) => {
    if (!editingPlayer) return;
    const { error } = await supabase.from('players').update(updated).eq('id', editingPlayer.id);
    if (error) {
      toast({ title: t('roster.toast.saveError', 'No se pudo guardar'), description: error.message, variant: 'danger' });
      return;
    }
    toast({ title: t('roster.toast.playerUpdated', 'Jugador actualizado'), variant: 'success' });
    setEditingPlayer(null);
    setReloadToken((n) => n + 1);
  };

  const handleEditingPlayerPhotoChange = async (blob: Blob) => {
    if (!editingPlayer) return;
    const path = await uploadPlayerPhoto(orgId, editingPlayer.id, blob);
    const { error } = await supabase.from('players').update({ photo_url: path }).eq('id', editingPlayer.id);
    if (error) throw error;
    setReloadToken((n) => n + 1);
  };

  const handleDeactivate = async (player: RosterRow) => {
    const { error } = await supabase.from('players').update({ is_active: false }).eq('id', player.id);
    if (error) {
      toast({ title: t('roster.toast.deactivateError', 'No se pudo desactivar'), description: error.message, variant: 'danger' });
      return;
    }
    toast({
      title: t('roster.toast.deactivated', '{{name}} desactivado', { name: player.full_name }),
      variant: 'success',
    });
    setReloadToken((n) => n + 1);
  };

  const handleReactivate = async (player: RosterRow) => {
    const { error } = await supabase.from('players').update({ is_active: true }).eq('id', player.id);
    if (error) {
      toast({ title: t('roster.toast.reactivateError', 'No se pudo reactivar'), description: error.message, variant: 'danger' });
      return;
    }
    toast({
      title: t('roster.toast.reactivated', '{{name}} reactivado', { name: player.full_name }),
      variant: 'success',
    });
    setReloadToken((n) => n + 1);
  };

  const handleMarkRecovered = async (injury: Injury) => {
    const { error } = await supabase
      .from('injuries')
      .update({ return_date: new Date().toISOString().slice(0, 10) })
      .eq('id', injury.id);
    if (error) {
      toast({ title: t('roster.toast.updateError', 'No se pudo actualizar'), description: error.message, variant: 'danger' });
      return;
    }
    toast({ title: t('roster.toast.injuryRecovered', 'Lesión marcada como recuperada'), variant: 'success' });
    setReloadToken((n) => n + 1);
  };

  const handleDeleteInjury = async (injury: Injury) => {
    const { error } = await supabase.from('injuries').delete().eq('id', injury.id);
    if (error) {
      toast({ title: t('roster.toast.deleteError', 'No se pudo eliminar'), description: error.message, variant: 'danger' });
      return;
    }
    toast({ title: t('roster.toast.injuryDeleted', 'Registro de lesión eliminado'), variant: 'success' });
    setReloadToken((n) => n + 1);
  };

  const handleOpenProfile = (playerId: string) => navigate(`/atletas/${playerId}`);

  const columns = useMemo(
    () => buildColumns(t, canWrite(role), handleMarkRecovered, handleDeleteInjury, handleOpenProfile),
    [t, role],
  );

  if (state === 'error') return <ErrorState onRetry={() => setReloadToken((n) => n + 1)} />;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('roster.title', 'Roster físico')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('roster.subtitle', 'Posición, altura, peso y estado de lesión por jugador')}
          </p>
        </div>
        {canWrite(role) && (
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={showInactive} onCheckedChange={setShowInactive} />
              {t('roster.showInactive', 'Ver inactivos')}
            </label>
            {teams.length > 1 && (
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t('roster.teamPlaceholder', 'Equipo')} />
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
              triggerLabel={t('roster.import.triggerLabel', 'Importar roster (Excel)')}
              title={t('roster.import.title', 'Importar roster físico')}
              description={t(
                'roster.import.description',
                'Sube el Excel con columnas Name/Position/Weight/Height/Age/Recent injuries.',
              )}
              accept=".xlsx"
              expectedKind="roster"
              disabled={!teamId}
              parse={(workbook) => parseRoster(workbook, season)}
              describePreview={(parsed) =>
                t('roster.import.preview', 'Detecté {{players}} jugadores y {{injuries}} lesiones.', {
                  players: parsed.players.length,
                  injuries: parsed.injuries.length,
                })
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
        <EmptyState
          icon={UserRound}
          title={t('roster.empty.title', 'Sin roster todavía')}
          description={t('roster.empty.description', 'Corre el seed con --roster en el backend.')}
        />
      ) : (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t('roster.playersCard.title', 'Jugadores')}</CardTitle>
              <CardDescription className="mt-1">
                {t('roster.playersCard.description', '{{count}} jugadores registrados', { count: rows.length })}
              </CardDescription>
            </div>
          </CardHeader>
          <DataTable
            columns={columns}
            data={rows}
            getRowId={(row) => row.id}
            isLoading={state === 'loading'}
            searchPlaceholder={t('roster.searchPlaceholder', 'Buscar jugador…')}
            exportFileName="roster-fisico.csv"
            pageSize={15}
            showRowNumber
            persistKey="roster"
            rowActions={(row) => (
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" onClick={() => handleOpenProfile(row.id)}>
                  <UserSearch className="size-4" aria-hidden="true" />
                  <span className="sr-only">{t('roster.action.viewProfile', 'Ver ficha')}</span>
                </Button>
                {canWrite(role) &&
                  (showInactive ? (
                    <Button variant="ghost" size="sm" onClick={() => handleReactivate(row)}>
                      <Power className="size-4" aria-hidden="true" /> {t('roster.action.reactivate', 'Reactivar')}
                    </Button>
                  ) : (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => setEditingPlayer(row)}>
                        <Pencil className="size-4" aria-hidden="true" />
                        <span className="sr-only">{t('roster.action.edit', 'Editar')}</span>
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button variant="ghost" size="icon">
                            <Power className="size-4" aria-hidden="true" />
                            <span className="sr-only">{t('roster.action.deactivate', 'Desactivar')}</span>
                          </Button>
                        }
                        title={t('roster.confirmDeactivate.title', '¿Desactivar a {{name}}?', { name: row.full_name })}
                        description={t(
                          'roster.confirmDeactivate.description',
                          'Deja de aparecer en el roster activo; sus datos históricos (sesiones, stats) no se borran.',
                        )}
                        confirmLabel={t('roster.confirmDeactivate.confirmLabel', 'Desactivar')}
                        onConfirm={() => handleDeactivate(row)}
                      />
                    </>
                  ))}
              </div>
            )}
          />
        </Card>
      )}

      <EditPlayerDialog
        player={editingPlayer}
        onClose={() => setEditingPlayer(null)}
        onSave={handleSavePlayer}
        onPhotoChange={handleEditingPlayerPhotoChange}
      />
    </div>
  );
}
