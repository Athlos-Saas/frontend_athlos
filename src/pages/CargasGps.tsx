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
import { colors } from '@/constants/tokens';
import { supabase } from '@/lib/supabase';
import type { GpsSession, MlPrediction, Player } from '@/types/domain';

const ALERT_LABELS = ['alto', 'anomala'];

export default function CargasGps({ orgId }: { orgId: string }) {
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [sessions, setSessions] = useState<GpsSession[]>([]);
  const [alerts, setAlerts] = useState<MlPrediction[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [hasError, setHasError] = useState(false);

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
        if (data?.length) setSelectedPlayerId(data[0].id);
      });
  }, [orgId]);

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
        .in('prediction_type', ['fatigue_risk', 'anomaly'])
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
  }, [selectedPlayerId]);

  if (hasError) return <ErrorState onRetry={() => window.location.reload()} />;
  if (players === null) return <Spinner />;

  const activeAlerts = alerts.filter((alert) => ALERT_LABELS.includes(alert.label));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Cargas GPS</h1>
        <p className="mt-1 text-sm text-muted-foreground">Monitoreo físico por sesión con alertas del modelo</p>
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
              <EmptyState icon={AlertTriangle} title="Sin alertas activas" description="No hay fatiga ni sesiones anómalas recientes." />
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
                      <TableCell>{alert.prediction_type === 'fatigue_risk' ? 'Fatiga' : 'Anomalía'}</TableCell>
                      <TableCell>
                        <Badge variant={alert.label === 'alto' ? 'danger' : 'warning'}>{alert.label}</Badge>
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
