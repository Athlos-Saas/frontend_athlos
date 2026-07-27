import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, Gauge } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Trash2 } from 'lucide-react';

import { ComparisonBarChart } from '@/components/charts/ComparisonBarChart';
import { TrendLineChart } from '@/components/charts/TrendLineChart';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { ChartCard } from '@/components/ui/ChartCard';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Pagination } from '@/components/ui/Pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { usePagedRows } from '@/hooks/usePagedRows';
import { ImportDialog } from '@/components/import/ImportDialog';
import { ImportHistory } from '@/components/import/ImportHistory';
import { colors } from '@/constants/tokens';
import { supabase } from '@/lib/supabase';
import { parseCatapult, validateCatapult } from '@/lib/importers/catapult';
import { downloadCatapultTemplate } from '@/lib/importers/templates';
import { getOrCreatePlayers } from '@/lib/importers/playerLookup';
import { useTeamSelection } from '@/lib/importers/useTeamSelection';
import { toast } from '@/store/toastStore';
import { getDateLocale } from '@/utils/dateLocale';
import { canWrite } from '@/utils/permissions';
import type { GpsSession, MlPrediction, Player } from '@/types/domain';

const ALERT_LABELS = ['alto', 'anomala', 'sobre_esfuerzo'];

export default function CargasGps({ orgId, role }: { orgId: string; role: string | null }) {
  const { t } = useTranslation();
  const TYPE_LABEL: Record<string, string> = {
    fatigue_risk: t('cargasGps.type.fatigue', 'Fatiga'),
    anomaly: t('cargasGps.type.anomaly', 'Anomalía'),
    player_load_expected: t('cargasGps.type.overload', 'Sobre-esfuerzo'),
  };
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
        .select('id, session_date, distance_km, sprint_distance_m, top_speed_kmh, player_load')
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

  const handleDeleteSession = async (sessionId: string) => {
    const { error } = await supabase.from('gps_sessions').delete().eq('id', sessionId);
    if (error) {
      toast({ title: t('cargasGps.toast.deleteErrorTitle', 'No se pudo eliminar la sesión'), description: error.message, variant: 'danger' });
      return;
    }
    toast({ title: t('cargasGps.toast.deleteSuccessTitle', 'Sesión eliminada'), variant: 'success' });
    setReloadToken((n) => n + 1);
  };

  const activeAlerts = alerts.filter((alert) => ALERT_LABELS.includes(alert.label));
  const sessionsPager = usePagedRows(sessions, 10);
  const alertsPager = usePagedRows(activeAlerts, 10);

  // Ojo: ningún hook puede ir después de estos returns condicionales.
  if (hasError) return <ErrorState onRetry={() => window.location.reload()} />;
  if (players === null) return <Spinner />;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('cargasGps.title', 'Cargas GPS')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('cargasGps.subtitle', 'Monitoreo físico por sesión con alertas del modelo')}</p>
        </div>
        {canWrite(role) && (
          <div className="flex items-center gap-2">
            {teams.length > 1 && (
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t('cargasGps.teamPlaceholder', 'Equipo')} />
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
              triggerLabel={t('cargasGps.import.triggerLabel', 'Importar sesiones GPS (Catapult)')}
              title={t('cargasGps.import.title', 'Importar sesiones GPS')}
              description={t('cargasGps.import.description', 'Sube el export CSV de Catapult (columnas Player Name, Player Load, Distance (km)...).')}
              accept=".csv"
              expectedKind="catapult"
              disabled={!teamId}
              parse={parseCatapult}
              describePreview={(parsed) => t('cargasGps.import.previewSummary', 'Detecté {{count}} sesiones.', { count: parsed.length })}
              validate={validateCatapult}
              onConfirm={handleCatapultImport}
              onDownloadTemplate={downloadCatapultTemplate}
            />
          </div>
        )}
      </div>

      {canWrite(role) && <ImportHistory orgId={orgId} kind="catapult" reloadToken={reloadToken} />}

      {players.length === 0 ? (
        <EmptyState icon={Activity} title={t('cargasGps.noPlayersTitle', 'Aún no hay jugadores')} description={t('cargasGps.noPlayersDescription', 'Corre el seed del backend para poblar la organización.')} />
      ) : (
        <>
          <div className="mb-5 max-w-xs">
            <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
              <SelectTrigger>
                <SelectValue placeholder={t('cargasGps.selectPlayerPlaceholder', 'Selecciona un jugador')} />
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
            <EmptyState icon={Activity} title={t('cargasGps.noSessionsTitle', 'Sin sesiones registradas')} description={t('cargasGps.noSessionsDescription', 'Este jugador todavía no tiene sesiones GPS.')} />
          ) : (
            <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard title={t('cargasGps.chart.playerLoad', 'Player Load por sesión')} isLoading={isLoadingDetail}>
                <TrendLineChart data={sessions} xKey="session_date" yKey="player_load" name="Player Load" color={colors.green} />
              </ChartCard>
              <ChartCard title={t('cargasGps.chart.topSpeed', 'Velocidad máxima (km/h)')} isLoading={isLoadingDetail}>
                <ComparisonBarChart data={sessions} xKey="session_date" yKey="top_speed_kmh" name={t('cargasGps.chart.topSpeedSeries', 'Vel. máx')} color={colors.blue} />
              </ChartCard>
            </div>
          )}

          {sessions.length > 0 && (
            <Card className="mb-5">
              <CardHeader>
                <CardTitle>{t('cargasGps.sessionsTitle', 'Sesiones')}</CardTitle>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('cargasGps.col.date', 'Fecha')}</TableHead>
                    <TableHead className="text-right">{t('cargasGps.col.distance', 'Distancia (km)')}</TableHead>
                    <TableHead className="text-right">{t('cargasGps.col.playerLoad', 'Player Load')}</TableHead>
                    <TableHead className="text-right">{t('cargasGps.col.topSpeed', 'Vel. máx (km/h)')}</TableHead>
                    {canWrite(role) && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessionsPager.paged.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="text-muted-foreground">{session.session_date}</TableCell>
                      <TableCell className="text-right">{session.distance_km?.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{session.player_load?.toFixed(0)}</TableCell>
                      <TableCell className="text-right">{session.top_speed_kmh?.toFixed(1)}</TableCell>
                      {canWrite(role) && (
                        <TableCell className="text-right">
                          <ConfirmDialog
                            trigger={
                              <Button variant="ghost" size="icon">
                                <Trash2 className="size-4" aria-hidden="true" />
                                <span className="sr-only">{t('cargasGps.deleteSr', 'Eliminar')}</span>
                              </Button>
                            }
                            title={t('cargasGps.deleteConfirm.title', '¿Eliminar esta sesión?')}
                            description={t('cargasGps.deleteConfirm.description', 'Se borra la sesión GPS completa (todas sus columnas y zonas). Si el dato está mal, puedes reimportar el archivo corregido después.')}
                            confirmLabel={t('cargasGps.deleteConfirm.confirmLabel', 'Eliminar')}
                            onConfirm={() => handleDeleteSession(session.id)}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination page={sessionsPager.page} pageCount={sessionsPager.pageCount} onPageChange={sessionsPager.setPage} className="mt-4" />
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>{t('cargasGps.alertsTitle', 'Alertas del modelo')}</CardTitle>
              {activeAlerts.length > 0 && (
                <Badge variant="danger">{t('cargasGps.activeCount', '{{count}} activas', { count: activeAlerts.length })}</Badge>
              )}
            </CardHeader>

            {!isLoadingDetail && alerts.length === 0 && (
              <EmptyState
                icon={Gauge}
                title={t('cargasGps.noPredictionsTitle', 'Sin predicciones aún')}
                description={
                  <>
                    {t('cargasGps.noPredictionsDescriptionPrefix', 'Corre ')}
                    <code>run_training.py</code>
                    {t('cargasGps.noPredictionsDescriptionSuffix', '.')}
                  </>
                }
              />
            )}
            {!isLoadingDetail && alerts.length > 0 && activeAlerts.length === 0 && (
              <EmptyState icon={AlertTriangle} title={t('cargasGps.noActiveAlertsTitle', 'Sin alertas activas')} description={t('cargasGps.noActiveAlertsDescription', 'No hay fatiga, sobre-esfuerzo ni sesiones anómalas recientes.')} />
            )}
            {activeAlerts.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('cargasGps.col.type', 'Tipo')}</TableHead>
                    <TableHead>{t('cargasGps.col.label', 'Etiqueta')}</TableHead>
                    <TableHead>{t('cargasGps.col.score', 'Score')}</TableHead>
                    <TableHead>{t('cargasGps.col.date', 'Fecha')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alertsPager.paged.map((alert, index) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <TableRow key={index}>
                      <TableCell>{TYPE_LABEL[alert.prediction_type] ?? alert.prediction_type}</TableCell>
                      <TableCell>
                        <Badge variant={alert.label === 'anomala' ? 'warning' : 'danger'}>{alert.label}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{Number(alert.score).toFixed(3)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(alert.created_at).toLocaleDateString(getDateLocale())}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {activeAlerts.length > 0 && (
              <Pagination page={alertsPager.page} pageCount={alertsPager.pageCount} onPageChange={alertsPager.setPage} className="mt-4" />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
