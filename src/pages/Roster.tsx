import { useEffect, useMemo, useState } from 'react';
import { UserRound } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip';
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable';
import { supabase } from '@/lib/supabase';
import type { Injury, Player } from '@/types/domain';

type LoadState = 'loading' | 'error' | 'ready';

interface RosterRow extends Player {
  injury?: Injury;
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

const COLUMNS: DataTableColumn<RosterRow>[] = [
  { id: 'full_name', header: 'Jugador', sortable: true, accessor: (row) => row.full_name, className: 'font-medium text-foreground' },
  { id: 'position', header: 'Posición', sortable: true, accessor: (row) => row.position ?? '—' },
  { id: 'height_cm', header: 'Altura (cm)', align: 'right', sortable: true, accessor: (row) => row.height_cm ?? 0, cell: (row) => (row.height_cm ? row.height_cm.toFixed(0) : '—') },
  { id: 'weight_kg', header: 'Peso (kg)', align: 'right', sortable: true, accessor: (row) => row.weight_kg ?? 0, cell: (row) => (row.weight_kg ? row.weight_kg.toFixed(0) : '—') },
  { id: 'age', header: 'Edad', align: 'right', sortable: true, accessor: (row) => ageFromBirthdate(row.birthdate) ?? 0, cell: (row) => ageFromBirthdate(row.birthdate) ?? '—' },
  {
    id: 'injury',
    header: 'Estado',
    accessor: (row) => (row.injury ? row.injury.severity : 'ok'),
    cell: (row) =>
      row.injury ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant={SEVERITY_VARIANT[row.injury.severity]}>Lesionado</Badge>
            </TooltipTrigger>
            <TooltipContent>{row.injury.notes ?? 'Sin detalle'}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <Badge variant="success">Disponible</Badge>
      ),
  },
];

export default function Roster({ orgId }: { orgId: string }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setState('loading');
    Promise.all([
      supabase
        .from('players')
        .select('id, full_name, position, height_cm, weight_kg, birthdate')
        .eq('org_id', orgId)
        .order('full_name'),
      supabase.from('injuries').select('player_id, severity, notes').eq('org_id', orgId).is('return_date', null),
    ]).then(([playersRes, injuriesRes]) => {
      if (!isMounted) return;
      if (playersRes.error || injuriesRes.error) {
        setState('error');
        return;
      }
      setPlayers(playersRes.data ?? []);
      setInjuries(injuriesRes.data ?? []);
      setState('ready');
    });
    return () => {
      isMounted = false;
    };
  }, [orgId, reloadToken]);

  const rows: RosterRow[] = useMemo(() => {
    const injuryByPlayer = new Map(injuries.map((injury) => [injury.player_id, injury]));
    return players.map((player) => ({ ...player, injury: injuryByPlayer.get(player.id) }));
  }, [players, injuries]);

  if (state === 'error') return <ErrorState onRetry={() => setReloadToken((n) => n + 1)} />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Roster físico</h1>
        <p className="mt-1 text-sm text-muted-foreground">Posición, altura, peso y estado de lesión por jugador</p>
      </div>

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
            columns={COLUMNS}
            data={rows}
            getRowId={(row) => row.id}
            isLoading={state === 'loading'}
            searchPlaceholder="Buscar jugador…"
            exportFileName="roster-fisico.csv"
            pageSize={15}
          />
        </Card>
      )}
    </div>
  );
}
