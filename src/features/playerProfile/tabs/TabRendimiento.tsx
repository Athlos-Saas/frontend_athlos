import { useMemo } from 'react';
import { Activity } from 'lucide-react';

import { SpeedComparisonChart } from '@/components/charts/SpeedComparisonChart';
import { TrendLineChart } from '@/components/charts/TrendLineChart';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { ChartCard } from '@/components/ui/ChartCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { usePagedRows } from '@/hooks/usePagedRows';
import { colors } from '@/constants/tokens';
import { formatDate, formatDateTime } from '../format';
import { usePlayerGpsSessions, usePlayerPredictions, usePlayerVideoTracks } from '../queries';
import { buildSpeedTimeline } from '../speedTimeline';

const ALERT_TYPES = ['fatigue_risk', 'anomaly', 'player_load_expected'];
const ALERT_LABELS = ['alto', 'anomala', 'sobre_esfuerzo'];
const TYPE_LABEL: Record<string, string> = {
  fatigue_risk: 'Fatiga',
  anomaly: 'Anomalía',
  player_load_expected: 'Sobre-esfuerzo',
};

export default function TabRendimiento({ orgId, playerId }: { orgId: string; playerId: string }) {
  const sessions = usePlayerGpsSessions(orgId, playerId);
  const predictions = usePlayerPredictions(orgId, playerId);
  const videoTracks = usePlayerVideoTracks(orgId, playerId);

  const sessionRows = sessions.data ?? [];
  const { timeline: speedTimeline, videosWithoutDate } = useMemo(
    () => buildSpeedTimeline(sessionRows, videoTracks.data ?? []),
    [sessionRows, videoTracks.data],
  );

  const alerts = (predictions.data ?? []).filter(
    (prediction) => ALERT_TYPES.includes(prediction.prediction_type) && ALERT_LABELS.includes(prediction.label),
  );
  const alertsPager = usePagedRows(alerts, 10);

  if (sessions.isLoading || predictions.isLoading || videoTracks.isLoading) return <Skeleton className="h-80 w-full" />;

  if (sessionRows.length === 0 && speedTimeline.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="Sin datos de rendimiento"
        description="Este jugador todavía no tiene sesiones GPS ni video con fecha de partido registrados."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {sessionRows.length > 0 && (
          <ChartCard title="Player Load por sesión">
            <TrendLineChart data={sessionRows} xKey="session_date" yKey="player_load" name="Player Load" color={colors.green} />
          </ChartCard>
        )}
        {speedTimeline.length > 0 && (
          <ChartCard title="Velocidad máxima: GPS vs. video (km/h)">
            <SpeedComparisonChart data={speedTimeline} />
          </ChartCard>
        )}
      </div>
      {videosWithoutDate > 0 && (
        <p className="text-xs text-muted-foreground">
          {videosWithoutDate} lectura{videosWithoutDate === 1 ? '' : 's'} de video de este jugador no tiene
          {videosWithoutDate === 1 ? '' : 'n'} fecha de partido y no aparece
          {videosWithoutDate === 1 ? '' : 'n'} en la comparación — se puede agregar la fecha editando el video en
          Video análisis.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Alertas del modelo</CardTitle>
          {alerts.length > 0 && <Badge variant="danger">{alerts.length} en total</Badge>}
        </CardHeader>
        {alerts.length === 0 ? (
          <EmptyState title="Sin alertas" description="No hay fatiga, sobre-esfuerzo ni sesiones anómalas registradas para este jugador." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Etiqueta</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead>Fecha</TableHead>
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
                    <TableCell className="text-right">{alert.score?.toFixed(3) ?? '--'}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(alert.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={alertsPager.page} pageCount={alertsPager.pageCount} onPageChange={alertsPager.setPage} className="mt-4" />
          </>
        )}
      </Card>

      {sessionRows.length > 0 && (
        <p className="text-xs text-muted-foreground">Última sesión: {formatDate(sessionRows[sessionRows.length - 1]?.session_date)}</p>
      )}
    </div>
  );
}
