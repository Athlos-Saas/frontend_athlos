import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, Gauge } from 'lucide-react';

import { ComparisonBarChart } from '@/components/charts/ComparisonBarChart';
import { TrendLineChart } from '@/components/charts/TrendLineChart';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { ChartCard } from '@/components/ui/ChartCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { ImportDialog } from '@/components/import/ImportDialog';
import { colors } from '@/constants/tokens';
import { supabase } from '@/lib/supabase';
import { parseCatapult } from '@/lib/importers/catapult';
import { downloadCatapultTemplate } from '@/lib/importers/templates';
import { getOrCreatePlayers } from '@/lib/importers/playerLookup';
import { useTeamSelection } from '@/lib/importers/useTeamSelection';
import { canWrite } from '@/utils/permissions';
import type { GpsSession, MlPrediction, Player } from '@/types/domain';

const ALERT_LABELS = ['alto', 'anomala', 'sobre_esfuerzo'];
const TYPE_LABEL: Record<string, string> = {
  fatigue_risk: 'Fatiga',
  anomaly: 'Anomalía',
  player_load_expected: 'Sobre-esfuerzo',
};

export default function CargasGps({ orgId, role }: { orgId: string; role: string | null }) {
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [sessions, setSessions] = useState<GpsSession[]>([]);
  const [alerts, setAlerts] = useState<MlPrediction[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const { teams, teamId, setTeamId } = useTeamSelection(orgId);

  useEffect(() => {
    supabase
      .from('players')
      .select('id, full_name')
      .eq('org_id', orgId)
      .order('full_name')
      .then(({ data, error }) => {
        if (error) {
          setHasError(true);
          return;
        }
        setPlayers(data ?? []);
        if (data?.length) setSelectedPlayerId((current) => current || data[0].id);
      });
  }, [orgId, reloadToken]);

  useEffect(() => {
    if (!selectedPlayerId) return;
    setIsLoadingDetail(true);
    Promise.all([
      supabase
        .from('gps_sessions')
        .select('session_date, distance_km, sprint_distance_m, top_speed_kmh, player_load')
        .eq('player_id', selectedPlayerId)
        .order('session_date'),
      supabase
        .from('ml_predictions')
        .select('prediction_type, label, score, created_at')
        .eq('player_id', selectedPlayerId)
        .in('prediction_type', ['fatigue_risk', 'anomaly', 'player_load_expected'])
        .order('created_at', { ascending: false })
        .limit(50),
    ]).then(([sessionsRes, alertsRes]) => {
      if (sessionsRes.error || alertsRes.error) {
        setHasError(true);
        setIsLoadingDetail(false);
        return;
      }
      setSessions(sessionsRes.data ?? []);
      setAlerts(alertsRes.data ?? []);
      setIsLoadingDetail(false);
    });
  }, [selectedPlayerId, reloadToken]);

  const handleCatapultImport = async (parsedSessions: ReturnType<typeof parseCatapult>) => {
    const names = [...new Set(parsedSessions.map((session) => session.player_name))];
    const nameToId = await getOrCreatePlayers(orgId, teamId, names);

    const rows = parsedSessions
      .map(({ player_name, ...rest }) => {
        const playerId = nameToId[player_name];
        return playerId ? { org_id: orgId, player_id: playerId, ...rest } : null;
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (rows.length > 0) {
      const { error } = await supabase
        .from('gps_sessions')
        .upsert(rows, { onConflict: 'player_id,session_date,session_title,split_name' });
      if (error) throw error;
    }

    setReloadToken((n) => n + 1);
    return { written: rows.length, skipped: parsedSessions.length - rows.length, warnings: [] };
  };

  if (hasError) return <ErrorState onRetry={() => window.location.reload()} />;
  if (players === null) return <Spinner />;

  const activeAlerts = alerts.filter((alert) => ALERT_LABELS.includes(alert.label));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Cargas GPS</h1>
          <p className="mt-1 text-sm text-muted-foreground">Monitoreo físico por sesión con alertas del modelo</p>
        </div>
        {canWrite(role) && (
          <div className="flex items-center gap-2">
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
              triggerLabel="Importar sesiones GPS (Catapult)"
              title="Importar sesiones GPS"
              description="Sube el export CSV de Catapult (columnas Player Name, Player Load, Distance (km)...)."
              accept=".csv"
              expectedKind="catapult"
              disabled={!teamId}
              parse={parseCatapult}
              describePreview={(parsed) => `Detecté ${parsed.length} sesiones.`}
              onConfirm={handleCatapultImport}
              onDownloadTemplate={downloadCatapultTemplate}
            />
          </div>
        )}
      </div>

      {players.length === 0 ? (
        <EmptyState icon={Activity} title="Aún no hay jugadores" description="Corre el seed del backend para poblar la organización." />
      ) : (
        <>
          <div className="mb-5 max-w-xs">
            <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un jugador" />
              </SelectTrigger>
              <SelectContent>
                {players.map((player) => (
                  <SelectItem key={player.id} value={player.id}>
                    {player.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {sessions.length === 0 && !isLoadingDetail ? (
            <EmptyState icon={Activity} title="Sin sesiones registradas" description="Este jugador todavía no tiene sesiones GPS." />
          ) : (
            <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard title="Player Load por sesión" isLoading={isLoadingDetail}>
                <TrendLineChart data={sessions} xKey="session_date" yKey="player_load" name="Player Load" color={colors.green} />
              </ChartCard>
              <ChartCard title="Velocidad máxima (km/h)" isLoading={isLoadingDetail}>
                <ComparisonBarChart data={sessions} xKey="session_date" yKey="top_speed_kmh" name="Vel. máx" color={colors.blue} />
              </ChartCard>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Alertas del modelo</CardTitle>
              {activeAlerts.length > 0 && <Badge variant="danger">{activeAlerts.length} activas</Badge>}
            </CardHeader>

            {!isLoadingDetail && alerts.length === 0 && (
              <EmptyState
                icon={Gauge}
                title="Sin predicciones aún"
                description={
                  <>
                    Corre <code>run_training.py</code>.
                  </>
                }
              />
            )}
            {!isLoadingDetail && alerts.length > 0 && activeAlerts.length === 0 && (
              <EmptyState icon={AlertTriangle} title="Sin alertas activas" description="No hay fatiga, sobre-esfuerzo ni sesiones anómalas recientes." />
            )}
            {activeAlerts.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Etiqueta</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeAlerts.map((alert, index) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <TableRow key={index}>
                      <TableCell>{TYPE_LABEL[alert.prediction_type] ?? alert.prediction_type}</TableCell>
                      <TableCell>
                        <Badge variant={alert.label === 'anomala' ? 'warning' : 'danger'}>{alert.label}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{Number(alert.score).toFixed(3)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(alert.created_at).toLocaleDateString('es-ES')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
